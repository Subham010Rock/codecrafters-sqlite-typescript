import { open } from 'fs/promises';
import { constants } from 'fs';

const args = process.argv;
const databaseFilePath: string = args[2]
const command: string = args[3];

function calulateByteSizeForVarint(size:number,cellOffset:number,pageBuffer:any){
    while (size < 9 &&  new DataView(pageBuffer.buffer, 0, pageBuffer.length).getUint8(cellOffset + size - 1) >= 128) {
            size++;
    }
    return size;
}
async function getRootPageOfTable(noOfTables:number,databaseFileHandler:any,givenTable:string){
    // cell pointer array starts from index 108.
    // each cell pointer is of size 2 bytes.
    // it contains the offset of the cell.
    // its size is 2*noOfTables.
    const cellPointerArrayBuffer = new Uint8Array(noOfTables*2);
    await databaseFileHandler.read(cellPointerArrayBuffer, 0, cellPointerArrayBuffer.length, 108);

    for(let i=0;i<noOfTables;i++){
        // now i have offset of cell which can help to read the cell 
        const cellOffset = new DataView(cellPointerArrayBuffer.buffer, 0,cellPointerArrayBuffer.length).getUint16(i*2);
        //assuming size of record and rowid take 1 byte so at celloffset+2 we get record format
        const recordSizeBuffer = new Uint8Array(1);
        await databaseFileHandler.read(recordSizeBuffer,0,recordSizeBuffer.length,cellOffset);
        const recordSize = new DataView(recordSizeBuffer.buffer,0,recordSizeBuffer.length).getUint8(0);
        // console.log(`record size: ${recordSize}`);
        // records are stored in record-format.
        const record = new Uint8Array(recordSize+2);
        await databaseFileHandler.read(record,0,record.length,cellOffset);

        const recordHeaderSize = new DataView(record.buffer,0,record.length).getUint8(2);
        
        // Serial type for sqlite_schema.type
        // at offset 3 we have serial type for type
        const type_serial_type = new DataView(record.buffer,0,record.length).getUint8(3);
        const sqlite_schema_type_size = type_serial_type>=12 ? type_serial_type%2==0 ? (type_serial_type-12)/2 : (type_serial_type-13)/2 : type_serial_type;
        // console.log(`table type serial type: ${type_serial_type}`);
        // console.log(`table type serial size: ${sqlite_schema_type_size}`);

        // Serial type for sqlite_schema.name
        // at offset 4 we have serial type for name
        const name_serial_type = new DataView(record.buffer,0,record.length).getUint8(4);
        const sqlite_schema_name_size = name_serial_type>=12 ? name_serial_type%2==0 ? (name_serial_type-12)/2 : (name_serial_type-13)/2 : name_serial_type;
        // console.log(`table name serial type: ${name_serial_type}`);
        // console.log(`table name serial size: ${sqlite_schema_name_size}`);

        // Serial type for sqlite_schema.tbl_name
        // at offset 5 we have serial type for tbl_name
        const tbl_name_serial_type = new DataView(record.buffer,0,record.length).getUint8(5);

        //serial type value help to get the size of sqlite_schema.tbl_name
        const sqlite_schema_tbl_name_size = tbl_name_serial_type>=12 ? tbl_name_serial_type%2==0 ? (tbl_name_serial_type-12)/2 : (tbl_name_serial_type-13)/2 : tbl_name_serial_type;
        // console.log(`table name serial type: ${tbl_name_serial_type}`);
        // console.log(`table name serial size: ${sqlite_schema_tbl_name_size}`);

        //serial type for sqlite_schema.rootpage
        const rootpage_serial_type = new DataView(record.buffer,0,record.length).getUint8(6);
        const sqlite_schema_rootpage_size = rootpage_serial_type>=12 ? rootpage_serial_type%2==0 ? (rootpage_serial_type-12)/2 : (rootpage_serial_type-13)/2 : rootpage_serial_type;
        // console.log(`table rootpage serial type: ${rootpage_serial_type}`);
        // console.log(`table rootpage serial size: ${sqlite_schema_rootpage_size}`);

        //serial type for sqlite_schema.sql
        let sql_column_Size = 1;

        while (
            sql_column_Size < 9 && 
            new DataView(record.buffer, 0, record.length).getUint8(7 + sql_column_Size - 1) >= 128
        ) {
            sql_column_Size++;
        }
        // console.log(`sql column size: ${sql_column_Size}`);
        // 1. Read the two individual bytes
        let byte1 = new DataView(record.buffer,0,record.length).getUint8(7);
        let byte2 = new DataView(record.buffer,0,record.length).getUint8(8);

        // 2. Drop the high-order flag and mathematically combine them
        // (byte1 & 0x7F) isolates the 7 actual data bits of the first byte
        // << 7 shifts those bits left into their proper position
        // | byte2 combines them with the second byte
        const sql_serial_type = ((byte1 & 0x7F) << 7) | byte2;

        const sqlite_schema_sql_size = sql_serial_type>=12 ? sql_serial_type%2==0 ? (sql_serial_type-12)/2 : (sql_serial_type-13)/2 : sql_serial_type;
        // console.log(`table sql serial type: ${sql_serial_type}`);
        // console.log(`table sql serial size: ${sqlite_schema_sql_size}`);
    
        const tbl_name_offset = recordHeaderSize  + 2 + sqlite_schema_type_size + sqlite_schema_name_size;
        const tableNameBuffer = new Uint8Array(sqlite_schema_tbl_name_size);
        await databaseFileHandler.read(tableNameBuffer,0,tableNameBuffer.length,cellOffset + tbl_name_offset);
        const tableName = new TextDecoder().decode(tableNameBuffer);

        const rootPageOffset = tbl_name_offset + sqlite_schema_tbl_name_size;
        const rootPagebuffer = new Uint8Array(1); 
        await databaseFileHandler.read(rootPagebuffer,0,rootPagebuffer.length,cellOffset + rootPageOffset);
        const rootPage = new DataView(rootPagebuffer.buffer,0,rootPagebuffer.length).getUint8(0);

        const sqlOffset = rootPageOffset + sqlite_schema_rootpage_size;
        const sqlBuffer = new Uint8Array(sqlite_schema_sql_size);
        await databaseFileHandler.read(sqlBuffer,0,sqlBuffer.length,cellOffset + sqlOffset);
        const sql = new TextDecoder().decode(sqlBuffer);

        // console.log(`sql: ${sql}`);

        if(tableName == givenTable){
            return rootPage;
        }
}
}

async function consoleRowName(noOfRows:number, databaseFileHandler:any,targetTableRootPageOffset:number){
     // cell pointer array starts from index 108.
    // each cell pointer is of size 2 bytes.
    // it contains the offset of the cell.
    // its size is 2*noOfTables.

    // 1. Allocate ONE buffer for the entire page (assuming 4096 byte page size)
    const pageSize = 4096; 
    const pageBuffer = new Uint8Array(pageSize);

    // 2. Read the entire page from the file into your buffer ONCE
    await databaseFileHandler.read(pageBuffer, 0, pageSize, targetTableRootPageOffset);

    // 3. Create ONE DataView to read from the entire page
    const pageView = new DataView(pageBuffer.buffer);

    // Find your cell pointer array offset (8 bytes after the start of a leaf page)
    const cellPointerArrayOffset = 8; 

    for(let i=0;i<noOfRows;i++){
        // now i have offset of cell which can help to read the cell 
        const cellOffset = pageView.getUint16(cellPointerArrayOffset + i*2);
        // console.log(`cell offset: ${cellOffset}`);

        // Set a pointer to track exactly where we are in the cell
        let currentOffset = cellOffset;

        let payloadVarint = 1;
        payloadVarint = calulateByteSizeForVarint(payloadVarint,currentOffset,pageBuffer);

        currentOffset += payloadVarint;

        let rowIdVarint = 1;
        rowIdVarint = calulateByteSizeForVarint(rowIdVarint,currentOffset,pageBuffer);

        currentOffset += rowIdVarint;

        let recordHeaderSizeLength = 1;
        recordHeaderSizeLength = calulateByteSizeForVarint(recordHeaderSizeLength,currentOffset,pageBuffer);
        
        // console.log(`record header size length: ${recordHeaderSizeLength}`);
        
        const recordHeaderSize = pageView.getUint8(currentOffset);
        currentOffset += recordHeaderSizeLength;
        let nameColumnSize=0;
        for(let i=0;i<recordHeaderSize-1;i++){
            let serialTypeVarint = 1;
            serialTypeVarint = calulateByteSizeForVarint(serialTypeVarint,currentOffset,pageBuffer);
            let serialType = pageView.getUint8(currentOffset);
            serialType = serialType>=12 ? serialType%2==0 ? (serialType-12)/2 : (serialType-13)/2 : serialType;
            if(i==1){
                nameColumnSize = serialType;
            }
            // console.log(`serial type: ${serialType}`);
            currentOffset += serialTypeVarint;
        }
        const nameBuffer = pageBuffer.slice(currentOffset,currentOffset+nameColumnSize);
        console.log(`${new TextDecoder().decode(nameBuffer)}`);
        
    }
}

if (command === ".dbinfo") {
    const databaseFileHandler = await open(databaseFilePath, constants.O_RDONLY);
    const buffer: Uint8Array = new Uint8Array(113);
    await databaseFileHandler.read(buffer, 0, buffer.length, 0);
    // You can use print statements as follows for debugging, they'll be visible when running tests.
    console.error("Logs from your program will appear here!");

    // TODO: Uncomment the code below to pass the first stage    
    const pageSize = new DataView(buffer.buffer, 0, buffer.byteLength).getUint16(16);
    const noOfTables = new DataView(buffer.buffer, 0, buffer.byteLength).getUint16(103);
    console.log(`database page size: ${pageSize}`);
    console.log(`number of tables: ${noOfTables}`);
    await databaseFileHandler.close();
}
else if(command == ".tables"){
    const databaseFileHandler = await open(databaseFilePath, constants.O_RDONLY);

    // b-tree page header is of size 8 or 12.
    // if the first byte is 0x05 then b-tree page header is of size 12.
    // but for now we are assuming it of size 8.
    const pageHeaderBuffer: Uint8Array = new Uint8Array(8);
    await databaseFileHandler.read(pageHeaderBuffer, 0, pageHeaderBuffer.length, 100);
    const noOfTables = new DataView(pageHeaderBuffer.buffer, 0, pageHeaderBuffer.byteLength).getUint16(3);

    
    // cell pointer array starts from index 108.
    // each cell pointer is of size 2 bytes.
    // it contains the offset of the cell.
    // its size is 2*noOfTables.
    const cellPointerArrayBuffer = new Uint8Array(noOfTables*2);
    await databaseFileHandler.read(cellPointerArrayBuffer, 0, cellPointerArrayBuffer.length, 108);

    for(let i=0;i<noOfTables;i++){
        // now i have offset of cell which can help to read the cell 
        const cellOffset = new DataView(cellPointerArrayBuffer.buffer, 0,cellPointerArrayBuffer.length).getUint16(i*2);
        //assuming size of record and rowid take 1 byte so at celloffset+2 we get record format
        const recordSizeBuffer = new Uint8Array(1);
        await databaseFileHandler.read(recordSizeBuffer,0,recordSizeBuffer.length,cellOffset);
        const recordSize = new DataView(recordSizeBuffer.buffer,0,recordSizeBuffer.length).getUint8(0);
        // records are stored in record-format.
        const record = new Uint8Array(recordSize+2);
        await databaseFileHandler.read(record,0,record.length,cellOffset);

        const recordHeaderSize = new DataView(record.buffer,0,record.length).getUint8(2);
        
        // Serial type for sqlite_schema.type
        // at offset 3 we have serial type for type
        const type_serial_type = new DataView(record.buffer,0,record.length).getUint8(3);
        const sqlite_schema_type_size = type_serial_type>=12 ? type_serial_type%2==0 ? (type_serial_type-12)/2 : (type_serial_type-13)/2 : type_serial_type;
        // console.log(`table type serial type: ${type_serial_type}`);
        // console.log(`table type serial size: ${sqlite_schema_type_size}`);

        // Serial type for sqlite_schema.name
        // at offset 4 we have serial type for name
        const name_serial_type = new DataView(record.buffer,0,record.length).getUint8(4);
        const sqlite_schema_name_size = name_serial_type>=12 ? name_serial_type%2==0 ? (name_serial_type-12)/2 : (name_serial_type-13)/2 : name_serial_type;
        // console.log(`table name serial type: ${name_serial_type}`);
        // console.log(`table name serial size: ${sqlite_schema_name_size}`);

        // Serial type for sqlite_schema.tbl_name
        // at offset 5 we have serial type for tbl_name
        const tbl_name_serial_type = new DataView(record.buffer,0,record.length).getUint8(5);

        //serial type value help to get the size of sqlite_schema.tbl_name
        const sqlite_schema_tbl_name_size = tbl_name_serial_type>=12 ? tbl_name_serial_type%2==0 ? (tbl_name_serial_type-12)/2 : (tbl_name_serial_type-13)/2 : tbl_name_serial_type;
        // console.log(`table name serial type: ${tbl_name_serial_type}`);
        // console.log(`table name serial size: ${sqlite_schema_tbl_name_size}`);

        const tbl_name_offset = recordHeaderSize  + 2 + sqlite_schema_type_size + sqlite_schema_name_size;
        const tableNameBuffer = new Uint8Array(sqlite_schema_tbl_name_size);
        await databaseFileHandler.read(tableNameBuffer,0,tableNameBuffer.length,cellOffset + tbl_name_offset);
        console.log(`${new TextDecoder().decode(tableNameBuffer)}`);
    }
    // console.log(`no of tables: ${noOfTables}`);
    await databaseFileHandler.close();

}
 else {
    const databaseFileHandler = await open(databaseFilePath, constants.O_RDONLY);
    const pageHeaderBuffer: Uint8Array = new Uint8Array(8);
    await databaseFileHandler.read(pageHeaderBuffer, 0, pageHeaderBuffer.length, 100);
    const noOfTables = new DataView(pageHeaderBuffer.buffer, 0, pageHeaderBuffer.byteLength).getUint16(3);
    const pageType = new DataView(pageHeaderBuffer.buffer, 0, pageHeaderBuffer.byteLength).getUint8(0);
    const commandArgs = command.split(" ");
    const tableName = commandArgs[3];
    const rootPage = await getRootPageOfTable(noOfTables,databaseFileHandler,tableName);
    // now we have to rootpage of my target table and based on that i can get offset of that table page header.
    if(rootPage){
        // we take 4096 because the first page size is 4096.
        const targetTableRootPageOffset = (rootPage - 1) * 4096;
        const targetTableHeaderBuffer = new Uint8Array(8);
        await databaseFileHandler.read(targetTableHeaderBuffer,0,targetTableHeaderBuffer.length,targetTableRootPageOffset);
        const targetTableHeaderType = new DataView(targetTableHeaderBuffer.buffer,0,targetTableHeaderBuffer.length).getUint8(0);
        const noOfCells= new DataView(targetTableHeaderBuffer.buffer,0,targetTableHeaderBuffer.length).getUint16(3);
        if(commandArgs[1] === 'COUNT(*)'){
            console.log(`${noOfCells}`);
        }else if(commandArgs[1]==='name'){
            await consoleRowName(noOfCells,databaseFileHandler,targetTableRootPageOffset);
        }
    }
    await databaseFileHandler.close();
}

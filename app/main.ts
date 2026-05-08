import { open } from 'fs/promises';
import { constants } from 'fs';

const args = process.argv;
const databaseFilePath: string = args[2]
const command: string = args[3];

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
        const tableName = new TextDecoder().decode(tableNameBuffer);

        const rootPageOffset = tbl_name_offset + sqlite_schema_tbl_name_size;
        const rootPagebuffer = new Uint8Array(1); 
        await databaseFileHandler.read(rootPagebuffer,0,rootPagebuffer.length,cellOffset + rootPageOffset);
        const rootPage = new DataView(rootPagebuffer.buffer,0,rootPagebuffer.length).getUint8(0);

        if(tableName == givenTable){
            return rootPage;
        }
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
    const commandArgs = command.split(" ");
    const tableName = commandArgs[3];
    const rootPage = await getRootPageOfTable(noOfTables,databaseFileHandler,tableName);
    // now we have to rootpage of my target table and based on that i can get offset of that table page header.
    if(rootPage){
        // we take 4096 because the first page size is 4096.
        const targetTableRootPageOffset = (rootPage - 1) * 4096;
        const targetTableHeaderBuffer = new Uint8Array(8);
        await databaseFileHandler.read(targetTableHeaderBuffer,0,targetTableHeaderBuffer.length,targetTableRootPageOffset);
        const noOfCells = new DataView(targetTableHeaderBuffer.buffer,0,targetTableHeaderBuffer.length).getUint16(3);
        console.log(`${noOfCells}`);
    }
    await databaseFileHandler.close();
}

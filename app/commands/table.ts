export async function table(databaseFileHandler:any){
    // b-tree page header is of size 8 or 12.
    // if the first byte is 0x05 then b-tree page header is of size 12.
    // but for now we are assuming it of size 8.
    const pageTypeBuffer: Uint8Array = new Uint8Array(1);
    await databaseFileHandler.read(pageTypeBuffer, 0, pageTypeBuffer.length, 100);
    const pageType = new DataView(pageTypeBuffer.buffer, 0, pageTypeBuffer.length).getUint8(0);
    // console.log(`page type: ${pageType}`);
    let pageHeaderSize = pageType == 0x05 ? 12 : 8;
    const pageHeaderBuffer: Uint8Array = new Uint8Array(pageHeaderSize);
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
        // console.log(`cell offset: ${cellOffset}`);
        //assuming size of record and rowid take 1 byte so at celloffset+2 we get record format
        const recordSizeBuffer = new Uint8Array(1);
        await databaseFileHandler.read(recordSizeBuffer,0,recordSizeBuffer.length,cellOffset);
        const recordSize = new DataView(recordSizeBuffer.buffer,0,recordSizeBuffer.length).getUint8(0);
        // console.log("record size: ",recordSize);
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

}
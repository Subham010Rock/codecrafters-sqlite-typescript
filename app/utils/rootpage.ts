
import { calulateByteSizeForVarint } from "./varint";
export async function getRootPageOfTable(noOfTables:number,databaseFileHandler:any,givenTable:string){
    // cell pointer array starts from index 108.
    // each cell pointer is of size 2 bytes.
    // it contains the offset of the cell.
    // its size is 2*noOfTables.

    const pageSize = 4096;
    const pageBuffer = new Uint8Array(pageSize);
    await databaseFileHandler.read(pageBuffer, 0, pageBuffer.length, 0);

    const pageView = new DataView(pageBuffer.buffer, 0, pageBuffer.length);
    const cellPointerArrayOffset = 108;

    for(let i=0;i<noOfTables;i++){
        // now i have offset of cell which can help to read the cell 
        const cellOffset = pageView.getUint16(cellPointerArrayOffset + i*2);
        // console.log(`cell offset: ${cellOffset}`);
        let currentOffset = cellOffset;

        let payloadVarint = 1
        payloadVarint = calulateByteSizeForVarint(payloadVarint,currentOffset,pageBuffer);
        // console.log("payload varint: ",payloadVarint);
        const payloadSize = pageView.getUint8(currentOffset);
        // console.log("payload size: ",payloadSize);
        currentOffset += payloadVarint;

        let rowidVarint = 1
        rowidVarint = calulateByteSizeForVarint(rowidVarint,currentOffset,pageBuffer);
        const rowid = pageView.getUint8(currentOffset);
        currentOffset += rowidVarint;

        let recordHeaderSizeLength = 1
        recordHeaderSizeLength = calulateByteSizeForVarint(recordHeaderSizeLength,currentOffset,pageBuffer);
        const recordHeaderSize = pageView.getUint8(currentOffset);
        currentOffset += recordHeaderSizeLength;

        let tableTypeVarint=1;
        tableTypeVarint= calulateByteSizeForVarint(tableTypeVarint,currentOffset,pageBuffer);
        const tableTypeSerialType = pageView.getUint8(currentOffset);
        const tableTypeSize = tableTypeSerialType >= 12 ? tableTypeSerialType % 2 == 0 ? (tableTypeSerialType - 12) / 2 : (tableTypeSerialType - 13) / 2 : tableTypeSerialType;
        currentOffset += tableTypeVarint;

        let tableNameVarint=1;
        tableNameVarint= calulateByteSizeForVarint(tableNameVarint,currentOffset,pageBuffer);
        const tableNameSerialType = pageView.getUint8(currentOffset);
        const tableNameSize = tableNameSerialType >= 12 ? tableNameSerialType % 2 == 0 ? (tableNameSerialType - 12) / 2 : (tableNameSerialType - 13) / 2 : tableNameSerialType;
        currentOffset += tableNameVarint;

        let tableTbl_NameVarint = 1;
        tableTbl_NameVarint= calulateByteSizeForVarint(tableTbl_NameVarint,currentOffset,pageBuffer);
        const tableTbl_NameSerialType = pageView.getUint8(currentOffset);
        const tableTbl_NameSize = tableTbl_NameSerialType >= 12 ? tableTbl_NameSerialType % 2 == 0 ? (tableTbl_NameSerialType - 12) / 2 : (tableTbl_NameSerialType - 13) / 2 : tableTbl_NameSerialType;
        currentOffset += tableTbl_NameVarint;

        let rootPageVarint=1;
        rootPageVarint= calulateByteSizeForVarint(rootPageVarint,currentOffset,pageBuffer);
        const rootPageSerialType = pageView.getUint8(currentOffset);
        const rootPageSize = rootPageSerialType >= 12 ? rootPageSerialType % 2 == 0 ? (rootPageSerialType - 12) / 2 : (rootPageSerialType - 13) / 2 : rootPageSerialType;
        currentOffset += rootPageVarint;
        // console.log(`current offset: ${currentOffset}`);
        let sqlVarint=1;
        sqlVarint= calulateByteSizeForVarint(sqlVarint,currentOffset,pageBuffer);
        let sqlSize;
        if(sqlVarint==2){
            const data1 = pageView.getUint8(currentOffset);
            const data2 = pageView.getUint8(currentOffset + 1);
            const sqlSerialType = (data1 & 0x7F) << 7 | data2;
            sqlSize = sqlSerialType >= 12 ? sqlSerialType % 2 == 0 ? (sqlSerialType - 12) / 2 : (sqlSerialType - 13) / 2 : sqlSerialType;
            currentOffset += sqlVarint;
        }
        else{
            sqlSize = pageView.getUint8(currentOffset);
            currentOffset += sqlVarint;
        }

        const sqlSchemaTypeOffset = currentOffset;
        const sqlSchemaNameOffset = sqlSchemaTypeOffset + tableTypeSize;
        const sqlSchemaTblNameOffset = sqlSchemaNameOffset + tableNameSize;
        const sqlSchemaRootPageOffset = sqlSchemaTblNameOffset + tableTbl_NameSize;
        const sqlSchemaSqlOffset = sqlSchemaRootPageOffset + rootPageSize;

        const tableTbl_NameBuffer = pageBuffer.slice(sqlSchemaTblNameOffset,sqlSchemaTblNameOffset + tableTbl_NameSize);
        const tableTbl_Name = new TextDecoder().decode(tableTbl_NameBuffer);
        // console.log(`table name: ${tableTbl_Name}`);

        if(tableTbl_Name == givenTable){
            const rootPage = pageView.getUint8(sqlSchemaRootPageOffset);
            const sqlBuffer = pageBuffer.slice(sqlSchemaSqlOffset,sqlSchemaSqlOffset + sqlSize);
            const sql = new TextDecoder().decode(sqlBuffer);
            return {rootPage,sql};
        }
    }
    return {};
}
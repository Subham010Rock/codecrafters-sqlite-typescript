
export async function dbinfo(databaseFileHandler:any){
    const buffer: Uint8Array = new Uint8Array(113);
    await databaseFileHandler.read(buffer, 0, buffer.length, 0);
    // You can use print statements as follows for debugging, they'll be visible when running tests.
    console.error("Logs from your program will appear here!");

    // TODO: Uncomment the code below to pass the first stage    
    const pageSize = new DataView(buffer.buffer, 0, buffer.byteLength).getUint16(16);
    const noOfTables = new DataView(buffer.buffer, 0, buffer.byteLength).getUint16(103);
    console.log(`database page size: ${pageSize}`);
    console.log(`number of tables: ${noOfTables}`);
}
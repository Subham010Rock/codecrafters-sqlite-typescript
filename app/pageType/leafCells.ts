import { consoleRowName } from "../utils/record";

export async function traverseLeafCellPointer(databaseFileHandler:any,pageOffset:number,columnPosition:Array<number>){
    // leafCell type page header is of 8 byte
    const pageBuffer = new Uint8Array(4096);
    await databaseFileHandler.read(pageBuffer,0,pageBuffer.length,pageOffset);
    const pageView = new DataView(pageBuffer.buffer,0,pageBuffer.length);
    const cellPointerArrayLength = pageView.getUint16(3);
    // console.log(cellPointerArrayLength);
    for(let i=0;i<cellPointerArrayLength;i++){
        const cellOffset = pageView.getUint16(8+(i*2));
        consoleRowName(cellOffset,pageView,pageBuffer,columnPosition,databaseFileHandler);
    }
}
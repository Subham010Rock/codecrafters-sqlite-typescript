import { returnPageTypeAndCellCount } from "./type";
import { traverseLeafCellPointer } from "./leafCells";
export async function traverseInteriorCellPointer(databaseFileHandler:any,pageOffset:number,columnPosition:Array<number>){
    const pageBuffer = new Uint8Array(4096);
    await databaseFileHandler.read(pageBuffer,0,pageBuffer.length,pageOffset);
    const pageView = new DataView(pageBuffer.buffer,0,pageBuffer.length);
    const cellPointerArrayLength = pageView.getUint16(3);
    // console.log(cellPointerArrayLength);
    for(let i=0;i<cellPointerArrayLength;i++){
        const cellOffset = pageView.getUint16(12+(i*2));
        const pageNo = pageView.getUint32(cellOffset);
        // console.log(pageNo);
        const pageOffset = (pageNo-1)*4096;
        const {pageType,noOfCells} = await returnPageTypeAndCellCount(databaseFileHandler,pageOffset);
        // console.log(`page type: ${pageType}, cell count ${noOfCells}`);
        if(pageType==13){
            traverseLeafCellPointer(databaseFileHandler,pageOffset,columnPosition)
        }else if(pageType==5){
            await traverseInteriorCellPointer(databaseFileHandler,pageOffset,columnPosition)
        }
    }
}
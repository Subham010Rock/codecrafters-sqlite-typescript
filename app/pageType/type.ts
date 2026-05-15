import { traverseLeafCellPointer } from "./leafCells";

export async function returnPageTypeAndCellCount(databaseFileHandler:any,pageOffset:number){
    const pageTypeAndCellBuffer = new Uint8Array(5);
    await databaseFileHandler.read(pageTypeAndCellBuffer,0,pageTypeAndCellBuffer.length,pageOffset);
    const pageType = new DataView(pageTypeAndCellBuffer.buffer,0,pageTypeAndCellBuffer.length).getInt8(0);
    const noOfCells = new DataView(pageTypeAndCellBuffer.buffer,0,pageTypeAndCellBuffer.length).getInt16(3);
    return {pageType,noOfCells};
}
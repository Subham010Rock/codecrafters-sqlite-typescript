import { calulateByteSizeForVarint } from "./varint";

function consoleColumn(currentOffset:number,pageBuffer:Uint8Array,columnSize:Array<number>,position:Array<number>){
    let columnsValue:Array<string> = [];
    for(let i=0;i<position.length;i++){
        let p = position[i];
        let startOffset=currentOffset;
        for(let j=0;j<p;j++){
            let colSize = columnSize[j];
            startOffset+=colSize;
        }
        const colunBuffer=pageBuffer.slice(startOffset,startOffset+columnSize[position[i]]);
        const column = new TextDecoder().decode(colunBuffer);
        columnsValue.push(column);
    }
    if(columnSize.length > 0){
        console.log(columnsValue.join("|"));
    }else{
        console.log(columnsValue[0]);
    }
}
export async function consoleRowName(cellOffset:number, pageView:DataView,pageBuffer:Uint8Array,position:Array<number>,dbFileHandler:any){
    let currentOffset = cellOffset;
    // console.log(`cellOffset: ${cellOffset}`)

    // if(bTreePageType==5){
    //     const pageNo = pageView.getUint32(currentOffset);
    //     let rowIdVarint = 1;
    //     rowIdVarint = calulateByteSizeForVarint(rowIdVarint,currentOffset+4,pageBuffer);
    //     const pageOffset = (pageNo-1)*4096;
    //     const pf = new Uint8Array(4096);
    //     await dbFileHandler.read(pf,0,pf.length,pageOffset);
    //     const pv = new DataView(pf.buffer,0,pf.length);
    //     const pt = pv.getUint8(0)
    //     console.log(pt);
    //     await consoleRowName(pageOffset,pv,pf,position,pt,dbFileHandler);
    //     console.log(pageNo);
    // }else{
        let payloadVarint = 1;
        payloadVarint = calulateByteSizeForVarint(payloadVarint,currentOffset,pageBuffer);
        // console.log(`payloadVarint: ${payloadVarint}`)
        const payloadSize = pageView.getUint8(currentOffset);
        // console.log(`payloadsize: ${payloadSize}`)
// 
        currentOffset += payloadVarint;

        let rowIdVarint = 1;
        rowIdVarint = calulateByteSizeForVarint(rowIdVarint,currentOffset,pageBuffer);

        currentOffset += rowIdVarint;

        let recordHeaderSizeLength = 1;
        recordHeaderSizeLength = calulateByteSizeForVarint(recordHeaderSizeLength,currentOffset,pageBuffer);
        
        // console.log(`record header size length: ${recordHeaderSizeLength}`);
        
        const recordHeaderSize = pageView.getUint8(currentOffset);
        // console.log(`record header size: ${recordHeaderSize}`);
        currentOffset += recordHeaderSizeLength;
        let columnSizeArray = new Array<number>();
        let startOffDataOffset = currentOffset;
        for(let i=0;i<recordHeaderSize-1;i++){
            let serialTypeVarint = 1;
            let nameColumnSize=0;
            serialTypeVarint = calulateByteSizeForVarint(serialTypeVarint,currentOffset,pageBuffer);
            let serialType = pageView.getUint8(currentOffset);
            serialType = serialType>=12 ? serialType%2==0 ? (serialType-12)/2 : (serialType-13)/2 : serialType;
            nameColumnSize+=serialType;
            columnSizeArray.push(nameColumnSize);
            currentOffset += serialTypeVarint;
        }
        // console.log(currentOffset,columnSizeArray,position);
        consoleColumn(currentOffset,pageBuffer,columnSizeArray,position);
    // } 

}
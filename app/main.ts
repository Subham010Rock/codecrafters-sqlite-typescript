import { open } from 'fs/promises';
import { constants } from 'fs';
import { dbinfo } from './commands/dbinfo';
import { table } from './commands/table';
import { sql } from './commands/sql';
import { getRootPageOfTable } from './utils/rootpage';
import { calulateByteSizeForVarint } from './utils/varint';
import { returnPageTypeAndCellCount } from './pageType/type';
import { traverseLeafCellPointer } from './pageType/leafCells';
import { traverseInteriorCellPointer } from './pageType/interiorCells';
const args = process.argv;
const databaseFilePath: string = args[2]
const command: string = args[3];

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

async function consoleRowName(cellOffset:number, pageView:DataView,pageBuffer:Uint8Array,position:Array<number>,bTreePageType:number,dbFileHandler:any){
    let currentOffset = cellOffset;

    if(bTreePageType==5){
        const pageNo = pageView.getUint32(currentOffset);
        let rowIdVarint = 1;
        rowIdVarint = calulateByteSizeForVarint(rowIdVarint,currentOffset+4,pageBuffer);
        const pageOffset = (pageNo-1)*4096;
        const pf = new Uint8Array(4096);
        await dbFileHandler.read(pf,0,pf.length,pageOffset);
        const pv = new DataView(pf.buffer,0,pf.length);
        const pt = pv.getUint8(0)
        console.log(pt);
        await consoleRowName(pageOffset,pv,pf,position,pt,dbFileHandler);
        console.log(pageNo);
    }else{
        let payloadVarint = 1;
        payloadVarint = calulateByteSizeForVarint(payloadVarint,currentOffset,pageBuffer);
        console.log(`payloadVarint: ${payloadVarint}`)
        const payloadSize = pageView.getUint8(currentOffset);
        console.log(`payloadsize: ${payloadSize}`)

        currentOffset += payloadVarint;

        let rowIdVarint = 1;
        rowIdVarint = calulateByteSizeForVarint(rowIdVarint,currentOffset,pageBuffer);

        currentOffset += rowIdVarint;

        let recordHeaderSizeLength = 1;
        recordHeaderSizeLength = calulateByteSizeForVarint(recordHeaderSizeLength,currentOffset,pageBuffer);
        
        console.log(`record header size length: ${recordHeaderSizeLength}`);
        
        const recordHeaderSize = pageView.getUint8(currentOffset);
        console.log(`record header size: ${recordHeaderSize}`);
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
    }

}

if (command === ".dbinfo") {
    const databaseFileHandler = await open(databaseFilePath, constants.O_RDONLY);
    await dbinfo(databaseFileHandler);
    await databaseFileHandler.close();
}
else if(command == ".tables"){
    const databaseFileHandler = await open(databaseFilePath, constants.O_RDONLY);
    await table(databaseFileHandler);
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
    const {rootPage,sql} = await getRootPageOfTable(noOfTables,databaseFileHandler,tableName);
    // now we have to rootpage of my target table and based on that i can get offset of that table page header.
    if(rootPage){
        // we take 4096 because the first page size is 4096.
        const targetTableRootPageOffset = (rootPage - 1) * 4096;
        const {pageType,noOfCells} = await returnPageTypeAndCellCount(databaseFileHandler,targetTableRootPageOffset);
        if(commandArgs[1].toLowerCase() === 'count(*)' ){
            console.log(sql);
            console.log(`${noOfCells}`);
        }else {
            // get the position of the column name we want to print.
            const columnsWithType = sql.substring(sql.indexOf("(")+1,sql.lastIndexOf(")"));
            const columnsWithTypeArr = columnsWithType.split(",");
            let multiColumn = commandArgs[1].split(",");
            let columnPosition  = [];
            for(let i = 0; i < columnsWithTypeArr.length; i++){
                const columnName = columnsWithTypeArr[i].trim().split(" ")[0].trim();
                for(let j=0;j<multiColumn.length;j++){
                    if(columnName === multiColumn[j].trim()){
                        columnPosition.push(i);
                    }
                }
            }
            if(pageType==13){
                traverseLeafCellPointer(databaseFileHandler,targetTableRootPageOffset,columnPosition)
            }else if(pageType==5){
                await traverseInteriorCellPointer(databaseFileHandler,targetTableRootPageOffset,columnPosition)
            }
            // console.log(columnPosition)
            // let pageSize = 4096;
            // let pageBuffer = new Uint8Array(pageSize);
            // await databaseFileHandler.read(pageBuffer,0,pageBuffer.length,targetTableRootPageOffset);
            // console.log(targetTableRootPageOffset)
            // const pageView = new DataView(pageBuffer.buffer,0,pageBuffer.length);
            // let bTreePageOffset=8;
            // if(targetTableHeaderType==5){
            //     bTreePageOffset+=4;
            // }
            // for(let i=0;i<noOfCells;i++){
            //     const cellOffset = pageView.getUint16(bTreePageOffset+i*2);
            //     console.log("cell offset: ",cellOffset);
            //     await consoleRowName(cellOffset,pageView,pageBuffer,columnPosition,targetTableHeaderType,databaseFileHandler);
            // }
            

        }
    }
    await databaseFileHandler.close();
}

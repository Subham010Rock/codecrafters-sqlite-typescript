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
    const commandLower = command.toLowerCase();
    const selectIndex = commandLower.indexOf("select ");
    const fromIndex = commandLower.indexOf(" from ");
    const whereIndex = commandLower.indexOf(" where ");
    
    let tableName = "";
    let columnsStr = "";
    let whereClause = "";
    let whereClauseColumnName= "";
    let whereClauseValue = "";
    if (selectIndex !== -1 && fromIndex !== -1) {
        columnsStr = command.substring(selectIndex + 7, fromIndex).trim();
        const afterFrom = command.substring(fromIndex + 6).trim();
        tableName = afterFrom.split(" ")[0];
        if(whereIndex !== -1){
            whereClause = command.substring(whereIndex + 6).trim();
            const [colName,value] = whereClause.split("=");
            whereClauseColumnName=colName.trim();
            whereClauseValue=value.trim();
        }
    } else {
        const commandArgs = command.split(" ");
        tableName = commandArgs[3];
    }

    const {rootPage,sql} = await getRootPageOfTable(noOfTables,databaseFileHandler,tableName);
    // now we have to rootpage of my target table and based on that i can get offset of that table page header.
    if(rootPage){
        // we take 4096 because the first page size is 4096.
        const targetTableRootPageOffset = (rootPage - 1) * 4096;
        const {pageType,noOfCells} = await returnPageTypeAndCellCount(databaseFileHandler,targetTableRootPageOffset);
        if(columnsStr.toLowerCase() === 'count(*)' ){
            // console.log(sql);
            console.log(`${noOfCells}`);
        }else {
            // get the position of the column name we want to print.
            const columnsWithType = sql.substring(sql.indexOf("(")+1,sql.lastIndexOf(")"));
            const columnsWithTypeArr = columnsWithType.split(",");
            let multiColumn = columnsStr.split(",").map(c => c.trim());
            let columnPosition  = [];
            let whereClauseColumnPosition=-1;
            let isRowId = false;
            for(let i=0; i<columnsWithTypeArr.length; i++){
                const columnName = columnsWithTypeArr[i].trim().split(" ")[0].trim();
                if(columnName.toLowerCase() === whereClauseColumnName.toLowerCase()){
                    whereClauseColumnPosition=i;
                    break;
                }
            }
            for(let j=0; j<multiColumn.length; j++){
                for(let i = 0; i < columnsWithTypeArr.length; i++){
                    const columnName = columnsWithTypeArr[i].trim().split(" ")[0].trim();
                    if(columnName.toLowerCase() === multiColumn[j].toLowerCase()){
                        if(multiColumn[j].toLowerCase()=='id'){
                            isRowId = true;
                            break;
                        }else{
                            columnPosition.push(i);
                            break;
                        }
                    }
                }
            }
            if(pageType==13){
                traverseLeafCellPointer(databaseFileHandler,targetTableRootPageOffset,columnPosition,whereClause,whereClauseColumnPosition,whereClauseValue,isRowId)
            }else if(pageType==5){
                await traverseInteriorCellPointer(databaseFileHandler,targetTableRootPageOffset,columnPosition,whereClause,whereClauseColumnPosition,whereClauseValue,isRowId)
            }
        }
    }
    await databaseFileHandler.close();
}

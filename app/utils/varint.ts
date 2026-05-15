export function calulateByteSizeForVarint(size:number,cellOffset:number,pageBuffer:any){
    while (size < 9 &&  new DataView(pageBuffer.buffer, 0, pageBuffer.length).getUint8(cellOffset + size - 1) >= 128) {
            size++;
    }
    return size;
}
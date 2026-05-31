export function calulateByteSizeForVarint(size:number,cellOffset:number,pageBuffer:any){
    while (size < 9 &&  new DataView(pageBuffer.buffer, 0, pageBuffer.length).getUint8(cellOffset + size - 1) >= 128) {
            size++;
    }
    return size;
}

export function getVarIntValue(varIntLength:number,pageView:any,currentOffset:number){
    let value = 0n;
    while (varIntLength < 9) {
    // Read the current byte
    let byte = pageView.getUint8(currentOffset + varIntLength);
    varIntLength++;

    if (varIntLength === 9) {
        // 9th byte: Use all 8 bits and shift the previous value by 8
        value = (value << 8n) | BigInt(byte);
        break; // A varint never exceeds 9 bytes
    } else {
        // Bytes 1-8: Drop the highest bit using & 0x7F to isolate the 7 data bits
        let dataBits = BigInt(byte & 0x7F);
        
        // Shift the previously accumulated value left by 7, then add the new bits
        value = (value << 7n) | dataBits;

        // If the byte is less than 128, the continuation flag is clear, so we stop
        if (byte < 128) {
            break;
        }
    }
    }
    return Number(value);
}
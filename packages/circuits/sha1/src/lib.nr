fn main(x : Field, y : pub Field) {
    assert(x != y);
}

// Convert 64-byte array to array of 16 u32s
fn msg_u8_to_u32(msg: [u8; 64]) -> [u32; 16]
{
    let mut msg32: [u32; 16] = [0; 16];

    for i in 0..16
    {
        for j in 0..4
        {
            msg32[15 - i] = (msg32[15 - i] << 8) + msg[64 - 4*(i + 1) + j] as u32;
        };
    };
    
    msg32
}

fn digest<N>(msg: [u8; N]) -> [u8; 20]{
    //448 = 56 bits
    //512 = 64 bits
    [0; 20]
}

#[test]
fn test_main() {
    main(1, 2);

    // Uncomment to make test fail
    // main(1, 1);
}

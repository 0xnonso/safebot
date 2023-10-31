use dep::std;
use dep::noir_merkleroot;

fn main (
    time: pub Field,
    otp: pub Field,
    path_indices: [Field; 8],
    siblings: [Field; 8],
    root: pub Field,
) {
    let hashedLeaf = std::hash::poseidon::bn254::hash_2([otp, time]);
    let new_root = noir_merkleroot::compute_merkle_root(hashedLeaf, path_indices, siblings);
    assert(new_root == root);
}

#[test]
fn test_main() {
    // Uncomment to make test fail
    // main(1, 1);
}

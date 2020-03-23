// 1:
// Given that there is an array contains number from 1 to 100.
// You have to design a programme / function to achieve below objectives:
// When the number is multiple of 3, print "bug"
// When the number is multiple of 5, print "fix"
// When the number is multiple of 3 and 5, print "bugfix"

function first(nums) {
    for (let i = 0; i < nums.length; i++) {
        if (i % 3 === 0) {
            console.log('bug');
        }
        if (i % 5 === 0) {
            console.log('fix');
        }
        if (i % 15 === 0) {
            console.log('bugfix');
        }
    }
}

// 2:
// Given two arrays, [1,2,3,4,5] and [2,3,1,0,5]
// find which number is/are not present in the second array
// ans: [4]
// 暴力法 T =O(n*m）S=O(n)
function second(nums1, nums2) {
    let res = [];
    for (let i = 0; i < nums1.length; i++) {
        if (nums2.indexOf(nums1[i]) == -1) res.push(nums1[i]);
    }
    return res;
}

console.log("second====", second([1, 2, 3, 4, 5], [2, 3, 1, 0, 5]));

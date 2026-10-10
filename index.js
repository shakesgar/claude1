const path = require('path')
const fs = require('fs')

console.log('Happy developing ✨')

// Absolute path of the folder containing this file
console.log('__dirname:    ', __dirname)
// Folder you ran `node` from (what relative fs paths are resolved against)
console.log('process.cwd():', process.cwd())

// Build a path from this file's folder, so it works wherever node is run from
const packagePath = path.join(__dirname, 'package.json')
console.log('joined:       ', packagePath)

// Pull a path apart
console.log('dirname:      ', path.dirname(packagePath))
console.log('basename:     ', path.basename(packagePath))
console.log('extname:      ', path.extname(packagePath))

// Relative pieces: `..` goes up one folder
console.log('parent folder:', path.resolve(__dirname, '..'))

// Use the path to read a real file
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
console.log('project name: ', pkg.name)

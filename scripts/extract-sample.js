const fs = require('fs');
const path = require('path');
const readline = require('readline');

// File paths
const originalPath = path.join(__dirname, '..', 'public', 'data', 'LASample.csv');
const samplePath = path.join(__dirname, '..', 'public', 'data', 'LASample_small_new.csv');

console.log('Extracting random 1000-person sample from LASample.csv...');

// Create readline interface for streaming large file
const fileStream = fs.createReadStream(originalPath);
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let header = '';
let dataLines = [];
let lineCount = 0;

rl.on('line', (line) => {
  if (lineCount === 0) {
    // First line is the header
    header = line;
    console.log('Header loaded:', header.split(',').length, 'columns');
  } else {
    // Collect all data lines
    dataLines.push(line);
  }
  lineCount++;
  
  if (lineCount % 100000 === 0) {
    console.log(`Processed ${lineCount} lines...`);
  }
});

rl.on('close', () => {
  console.log(`Total lines processed: ${lineCount}`);
  console.log(`Data lines collected: ${dataLines.length}`);
  
  // Randomly sample 1000 lines
  const sampleSize = Math.min(1000, dataLines.length);
  const sampledLines = [];
  
  // Create array of indices
  const indices = Array.from({ length: dataLines.length }, (_, i) => i);
  
  // Shuffle and take first 1000
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  
  // Take first 1000 indices
  for (let i = 0; i < sampleSize; i++) {
    sampledLines.push(dataLines[indices[i]]);
  }
  
  // Write the sample file
  const outputContent = [header, ...sampledLines].join('\n');
  fs.writeFileSync(samplePath, outputContent);
  
  console.log('✅ Successfully created LASample_small.csv!');
  console.log(`Sample size: ${sampledLines.length} records`);
  console.log(`Total columns: ${header.split(',').length}`);
  console.log(`Output file: ${samplePath}`);
});

rl.on('error', (error) => {
  console.error('Error reading file:', error);
});

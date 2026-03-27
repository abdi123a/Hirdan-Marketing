const TOKEN = 'd99de3c6e5e38c95ae65a5dccf66b92bfddc37f7e7d1f581244a83e8f14c811e'; // One of the tokens from previous output

async function test() {
  const url = `http://localhost:3001/api/verify/${TOKEN}`;
  console.log(`Checking ${url}...`);
  try {
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log('Data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();

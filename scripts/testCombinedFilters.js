async function callCombinedFilters(body) {
  const response = await fetch('http://localhost:3000/api/combined-filters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

async function main() {
  const body = {
    universeFields: [],
    geographicFilters: {
      state: ['VA']
    },
    demographicFilters: {},
    operator: 'AND',
    requestedLevels: ['state', 'county', 'dma']
  };

  const data = await callCombinedFilters(body);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(err => {
  console.error('Error calling combined-filters:', err);
  process.exit(1);
});


const API_BASE_URL = 'https://causewayappsapi-f9c7fmb8e5emhzbg.southcentralus-01.azurewebsites.net';
const API_KEY = '7i$6OdzDBQVIXJ2!';

async function main() {
  const geoId = Number(process.argv[2] || '1');
  const payload = {
    geoId,
    universeList: '',
    ageRangeIds: '',
    genderIds: '',
    partyIds: '',
    ethnicityIds: '',
    incomeIds: '',
    educationIds: '',
    generalVoteHistoryIds: '',
    primaryVoteHistoryIds: ''
  };

  const response = await fetch(`${API_BASE_URL}/api/Audience/count`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(err => {
  console.error('Error calling Audience/count:', err);
  process.exit(1);
});


import { apiService } from '@/lib/apiService';

async function main() {
  try {
    const geoId = Number(process.argv[2] || '1');
    const response = await apiService.getAudienceCount({
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
    });
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error calling Audience/count:', error);
  }
}

main();


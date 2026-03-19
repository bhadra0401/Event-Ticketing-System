export const sampleStudents = [
  {
    roll_number: '2021CS001',
    name: 'Aarav Kumar',
    email: 'aarav.kumar@example.com'
  },
  {
    roll_number: '2021CS002',
    name: 'Diya Sharma',
    email: 'diya.sharma@example.com'
  },
  {
    roll_number: '2021CS003',
    name: 'Arjun Patel',
    email: 'arjun.patel@example.com'
  },
  {
    roll_number: '2021CS004',
    name: 'Ananya Singh',
    email: 'ananya.singh@example.com'
  },
  {
    roll_number: '2021CS005',
    name: 'Rohan Mehta',
    email: 'rohan.mehta@example.com'
  }
];

export async function insertSampleData(supabase: any) {
  const { data, error } = await supabase
    .from('students')
    .insert(sampleStudents);

  if (error) {
    console.error('Error inserting sample data:', error);
    throw error;
  }

  return data;
}

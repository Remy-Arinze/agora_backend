/**
 * Example Usage of Generated RTK Query Hooks
 * 
 * After running `npm run generate-client`, you can use these hooks.
 * This file shows examples - the actual hooks will be in src/lib/api/generated/
 */

// Example 1: Fetching students list
/*
import { useGetStudentsQuery } from '@/lib/api/generated';

export function StudentsList() {
  const { data, isLoading, error } = useGetStudentsQuery({ 
    page: 1, 
    limit: 20 
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading students</div>;

  // data is fully typed as ResponseDto<PaginatedResponseDto<StudentDto>>
  return (
    <div>
      {data?.data.items.map((student) => (
        <div key={student.id}>
          <h3>{student.firstName} {student.lastName}</h3>
          <p>UID: {student.uid}</p>
        </div>
      ))}
    </div>
  );
}
*/

// Example 2: Getting a single student
/*
import { useGetStudentByIdQuery } from '@/lib/api/generated';

export function StudentDetail({ studentId }: { studentId: string }) {
  const { data, isLoading } = useGetStudentByIdQuery({ id: studentId });

  if (isLoading) return <div>Loading...</div>;

  // data is ResponseDto<StudentWithEnrollmentDto>
  const student = data?.data;
  
  return (
    <div>
      <h1>{student?.firstName} {student?.lastName}</h1>
      <p>UID: {student?.uid}</p>
      {student?.enrollment && (
        <div>
          <p>Class: {student.enrollment.classLevel}</p>
          <p>School: {student.enrollment.school.name}</p>
        </div>
      )}
    </div>
  );
}
*/

// Example 3: Bulk import mutation
/*
import { useBulkImportMutation } from '@/lib/api/generated';

export function BulkImportForm() {
  const [importStudents, { isLoading, isSuccess }] = useBulkImportMutation();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;

    try {
      const result = await importStudents({ file });
      // result.data is ResponseDto<ImportSummaryDto>
      console.log(`Imported ${result.data?.data.successCount} students`);
    } catch (error) {
      console.error('Import failed', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="file" name="file" accept=".xlsx,.csv" />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Importing...' : 'Import Students'}
      </button>
      {isSuccess && <p>Import completed!</p>}
    </form>
  );
}
*/

// Example 4: Login mutation
/*
import { useLoginMutation } from '@/lib/api/generated';
import { useDispatch } from 'react-redux';
import { setCredentials } from '@/lib/store/slices/authSlice';

export function LoginForm() {
  const dispatch = useDispatch();
  const [login, { isLoading }] = useLoginMutation();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const result = await login({
        email: formData.get('email') as string,
        password: formData.get('password') as string,
      });

      // result.data is ResponseDto<AuthTokensDto>
      if (result.data?.data) {
        dispatch(setCredentials({
          accessToken: result.data.data.accessToken,
          refreshToken: result.data.data.refreshToken,
          user: result.data.data.user,
        }));
      }
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" name="email" required />
      <input type="password" name="password" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
*/

// All types are auto-generated from the backend Swagger spec!
// No manual TypeScript interfaces needed.


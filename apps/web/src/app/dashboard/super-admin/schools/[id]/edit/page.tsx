'use client';

// Import the AddSchoolPage component
// It will automatically detect edit mode from the route params ([id] from parent segment)
import AddSchoolPage from '../../add/page';

export default function EditSchoolPage() {
  // The AddSchoolPage component uses useParams() which will get the [id] from the route
  return <AddSchoolPage />;
}


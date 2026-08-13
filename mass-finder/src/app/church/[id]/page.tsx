import Link from 'next/link';

import ChurchDetail from '@/components/ChurchDetail';
import { churchDetail } from '@/lib/service';

export const dynamic = 'force-dynamic';

/**
 * The full timetable for one church.
 *
 * Rendered on the server so the page is useful immediately, on a slow connection,
 * with no spinner — which is the difference between usable and not for the phones
 * this app is aimed at.
 */
export default async function ChurchPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const detail = await churchDetail({ churchId: id, days: 21 });

  if (!detail) {
    return (
      <main>
        <h1>We do not have that church</h1>
        <p>
          We could not find a record for that church. It may have been a while since
          you looked it up.
        </p>
        <div className="btn-row">
          <Link className="btn btn-primary" href="/">
            Search again
          </Link>
        </div>
      </main>
    );
  }

  return <ChurchDetail detail={detail} />;
}

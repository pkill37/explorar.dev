'use client';

import { useRouter } from 'next/navigation';
import RateLimitScreen from '@/components/RateLimitScreen';

export default function NotFound() {
  const router = useRouter();

  return (
    <RateLimitScreen
      emoji="🔍"
      title="Page Not Found"
      message="The page you're looking for doesn't exist or has been moved."
      buttonText="Go Home"
      onButtonClick={() => router.push('/')}
      showTimeMessage={false}
    />
  );
}

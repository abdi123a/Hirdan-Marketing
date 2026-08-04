import { Redirect } from 'expo-router';

/** Legacy route — Publish posts list now lives at the Social tab root. */
export default function SocialPlannerRedirect() {
  return <Redirect href="/(tabs)/social" />;
}

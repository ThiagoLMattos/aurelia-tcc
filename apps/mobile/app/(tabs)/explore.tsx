/**
 * This route was removed from the tab navigator.
 * Redirects to home to avoid dead routes.
 */
import { Redirect } from 'expo-router';

export default function ExploreRedirect() {
  return <Redirect href="/" />;
}

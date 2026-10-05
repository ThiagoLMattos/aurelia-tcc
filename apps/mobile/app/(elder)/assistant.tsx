import { useRouter } from 'expo-router';

import { EmptyState, Screen } from '@/components';

/** Placeholder until the elder's conversation with Aurélia is built. */
export default function ElderAssistantScreen() {
  const router = useRouter();
  return (
    <Screen role="elder" centered>
      <EmptyState role="elder" title="Aurélia" message="Em breve você poderá conversar por aqui." actionLabel="VOLTAR" onAction={() => router.back()} />
    </Screen>
  );
}

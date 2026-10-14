'use client';
import { useQuery } from '@tanstack/react-query';
import type { ModelSettings } from '@classiq/shared';
import { Card, ErrorState, LoadingBlock, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys } from '@/components/admin/queries';
import { ModelSettingsForm } from '@/components/admin/settings/model-settings-form';

export default function SettingsPage() {
  const settings = useQuery({
    queryKey: adminKeys.modelSettings,
    queryFn: ({ signal }) => api.get<ModelSettings>('/admin/settings/models', undefined, signal),
    refetchOnWindowFocus: false,
  });

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="AI settings"
        description="Models used to transcribe lesson audio and generate quiz questions. API keys are configured on the server and never shown here."
      />
      {settings.isPending ? (
        <LoadingBlock label="Loading settings…" />
      ) : settings.error ? (
        <Card>
          <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
        </Card>
      ) : (
        <ModelSettingsForm key={settings.dataUpdatedAt} settings={settings.data} />
      )}
    </>
  );
}

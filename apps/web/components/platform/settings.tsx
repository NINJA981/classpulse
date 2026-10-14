'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LLM_MODELS,
  PASSWORD_MIN_LENGTH,
  STT_MODELS,
  type AiPrices,
  type BannerSetting,
  type DefaultModelsSetting,
  type MaintenanceSetting,
  type PlatformSessionResponse,
  type PlatformSettings,
  type RecoveryCodesResponse,
  type SttProvider,
} from '@classiq/shared';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ErrorState,
  Field,
  InlineError,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  useToast,
} from '@/components/ui';
import { NoticeBanners } from '@/components/auth/platform-notice';
import { CopyButton } from '@/components/admin/common';
import { ApiError, api } from '@/lib/api';
import { platformKeys } from './queries';
import { usePlatformAdmin } from './shell';

function useSaveSettings(message: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (patch: Partial<PlatformSettings>) => api.put<PlatformSettings>('/platform/settings', patch),
    onSuccess: (s) => {
      qc.setQueryData(platformKeys.settings, s);
      toast(message);
    },
  });
}

/* ---------------------------------------------------------------- notices */

function NoticesCard({ settings }: { settings: PlatformSettings }) {
  const [maintenance, setMaintenance] = useState<MaintenanceSetting>(settings.maintenance);
  const [banner, setBanner] = useState<BannerSetting>(settings.banner);
  const save = useSaveSettings('Notices saved');
  const preview = {
    banner: banner.enabled && banner.message.trim() ? { message: banner.message, level: banner.level } : null,
    maintenance: maintenance.enabled
      ? { message: maintenance.message.trim() || 'ClassIQ is undergoing maintenance.', blockLogins: maintenance.blockLogins }
      : null,
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ maintenance, banner });
  };
  return (
    <Card>
      <CardHeader eyebrow="Every school" title="Maintenance and banner" />
      <CardBody>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Checkbox label="Maintenance mode" checked={maintenance.enabled} onChange={(e) => setMaintenance((m) => ({ ...m, enabled: e.target.checked }))} />
          <Field label="Maintenance message" hint="Shown on every sign-in page and inside the school app">
            {(p) => <Textarea {...p} rows={2} maxLength={500} value={maintenance.message} onChange={(e) => setMaintenance((m) => ({ ...m, message: e.target.value }))} />}
          </Field>
          <Checkbox
            label="Block school sign-ins and requests while in maintenance"
            checked={maintenance.blockLogins}
            onChange={(e) => setMaintenance((m) => ({ ...m, blockLogins: e.target.checked }))}
          />
          <hr className="border-line" />
          <Checkbox label="Show banner" checked={banner.enabled} onChange={(e) => setBanner((b) => ({ ...b, enabled: e.target.checked }))} />
          <Field label="Banner message">
            {(p) => <Input {...p} maxLength={300} value={banner.message} onChange={(e) => setBanner((b) => ({ ...b, message: e.target.value }))} />}
          </Field>
          <Field label="Banner level" className="sm:w-48">
            {(p) => (
              <Select {...p} value={banner.level} onChange={(e) => setBanner((b) => ({ ...b, level: e.target.value as BannerSetting['level'] }))}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </Select>
            )}
          </Field>
          <div>
            <p className="eyebrow mb-2">Preview</p>
            {preview.banner || preview.maintenance ? (
              <NoticeBanners notice={preview} />
            ) : (
              <p className="text-sm text-muted">Nothing is shown to schools right now.</p>
            )}
            {maintenance.enabled && maintenance.blockLogins && (
              <p className="mt-2 text-xs font-semibold text-warning">School users will be signed out and refused until you turn this off.</p>
            )}
          </div>
          <InlineError error={save.error} />
          <div>
            <Button type="submit" loading={save.isPending}>
              Save notices
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------- default models */

function DefaultModelsCard({ settings }: { settings: PlatformSettings }) {
  const [models, setModels] = useState<DefaultModelsSetting>(settings.defaultModels);
  const save = useSaveSettings('Default models saved');
  const fe = save.error instanceof ApiError ? save.error.fieldErrors : {};
  return (
    <Card>
      <CardHeader eyebrow="New schools" title="Default AI models" />
      <CardBody>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ defaultModels: models });
          }}
        >
          <p className="text-sm text-muted">Applied when a school is created. Each school’s admin can change them later.</p>
          <Field label="Speech-to-text provider">
            {(p) => (
              <Select
                {...p}
                value={models.sttProvider}
                onChange={(e) => {
                  const provider = e.target.value as SttProvider;
                  setModels((m) => ({ ...m, sttProvider: provider, sttModel: STT_MODELS[provider][0]!.id }));
                }}
              >
                <option value="sarvam">Sarvam</option>
                <option value="openai">OpenAI</option>
              </Select>
            )}
          </Field>
          <Field label="Speech-to-text model" error={fe['defaultModels.sttModel']}>
            {(p) => (
              <Select {...p} value={models.sttModel} onChange={(e) => setModels((m) => ({ ...m, sttModel: e.target.value }))}>
                {STT_MODELS[models.sttProvider].map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Quiz model" error={fe['defaultModels.llmModel']}>
            {(p) => (
              <Select {...p} value={models.llmModel} onChange={(e) => setModels((m) => ({ ...m, llmModel: e.target.value }))}>
                {LLM_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <InlineError error={save.error} />
          <div>
            <Button type="submit" loading={save.isPending}>
              Save default models
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------- AI prices */

type PriceDraft = { llm: Record<string, { inputPer1M: string; outputPer1M: string }>; stt: Record<string, { perHour: string }> };

function toDraft(prices: AiPrices): PriceDraft {
  const llmIds = [...new Set([...LLM_MODELS.map((m) => m.id), ...Object.keys(prices.llm)])];
  const sttIds = [...new Set([...Object.values(STT_MODELS).flat().map((m) => m.id), ...Object.keys(prices.stt)])];
  return {
    llm: Object.fromEntries(
      llmIds.map((id) => [id, { inputPer1M: prices.llm[id]?.inputPer1M.toString() ?? '', outputPer1M: prices.llm[id]?.outputPer1M.toString() ?? '' }]),
    ),
    stt: Object.fromEntries(sttIds.map((id) => [id, { perHour: prices.stt[id]?.perHour.toString() ?? '' }])),
  };
}

function fromDraft(d: PriceDraft): AiPrices {
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  const llm: AiPrices['llm'] = {};
  for (const [id, v] of Object.entries(d.llm)) {
    const i = num(v.inputPer1M);
    const o = num(v.outputPer1M);
    if (i !== null && o !== null) llm[id] = { inputPer1M: i, outputPer1M: o };
  }
  const stt: AiPrices['stt'] = {};
  for (const [id, v] of Object.entries(d.stt)) {
    const h = num(v.perHour);
    if (h !== null) stt[id] = { perHour: h };
  }
  return { llm, stt };
}

function PriceInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Input aria-label={label} type="number" min={0} step="0.01" inputMode="decimal" className="w-28" value={value} onChange={(e) => onChange(e.target.value)} />
  );
}

function PricesCard({ settings }: { settings: PlatformSettings }) {
  const [draft, setDraft] = useState<PriceDraft>(() => toDraft(settings.aiPrices));
  const save = useSaveSettings('Price rates saved');
  return (
    <Card>
      <CardHeader eyebrow="Usage & costs" title="AI price rates" />
      <CardBody className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          In US dollars. Used for cost <strong>estimates</strong> only — providers change prices, so check your provider invoices. Leave a row empty to
          skip it.
        </p>
        <Table>
          <THead>
            <tr>
              <TH>Quiz model</TH>
              <TH>Input per 1M tokens</TH>
              <TH>Output per 1M tokens</TH>
            </tr>
          </THead>
          <TBody>
            {Object.entries(draft.llm).map(([id, v]) => (
              <TR key={id}>
                <TD className="font-mono text-xs">{id}</TD>
                <TD>
                  <PriceInput label={`${id} input price per 1M tokens`} value={v.inputPer1M} onChange={(x) => setDraft((d) => ({ ...d, llm: { ...d.llm, [id]: { ...v, inputPer1M: x } } }))} />
                </TD>
                <TD>
                  <PriceInput label={`${id} output price per 1M tokens`} value={v.outputPer1M} onChange={(x) => setDraft((d) => ({ ...d, llm: { ...d.llm, [id]: { ...v, outputPer1M: x } } }))} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <Table>
          <THead>
            <tr>
              <TH>Speech-to-text model</TH>
              <TH>Per audio hour</TH>
            </tr>
          </THead>
          <TBody>
            {Object.entries(draft.stt).map(([id, v]) => (
              <TR key={id}>
                <TD className="font-mono text-xs">{id}</TD>
                <TD>
                  <PriceInput label={`${id} price per audio hour`} value={v.perHour} onChange={(x) => setDraft((d) => ({ ...d, stt: { ...d.stt, [id]: { perHour: x } } }))} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <InlineError error={save.error} />
        <div>
          <Button loading={save.isPending} onClick={() => save.mutate({ aiPrices: fromDraft(draft) })}>
            Save price rates
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------- my account */

function AccountCard() {
  const admin = usePlatformAdmin();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const change = useMutation({
    mutationFn: () => api.post<PlatformSessionResponse>('/platform/auth/change-password', { currentPassword: current, newPassword: next }),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      toast('Password changed. Other sessions were signed out.');
    },
  });
  const regenerate = useMutation({
    mutationFn: () => api.post<RecoveryCodesResponse>('/platform/auth/recovery-codes/regenerate', { code }),
    onSuccess: (res) => {
      setCode('');
      setCodes(res.recoveryCodes);
    },
  });
  const mismatch = confirm.length > 0 && next !== confirm;

  return (
    <Card>
      <CardHeader eyebrow={admin.email} title="My account" />
      <CardBody className="grid gap-8 lg:grid-cols-2">
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (next === confirm) change.mutate();
          }}
        >
          <p className="font-bold">Change password</p>
          <Field label="Current password" required>
            {(p) => <Input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
          </Field>
          <Field label="New password" required hint={`At least ${PASSWORD_MIN_LENGTH} characters`}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
          </Field>
          <Field label="Confirm new password" required error={mismatch ? 'Passwords do not match' : null}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
          <InlineError error={change.error} />
          <div>
            <Button type="submit" loading={change.isPending} disabled={!current || next.length < PASSWORD_MIN_LENGTH || next !== confirm}>
              Change password
            </Button>
          </div>
        </form>

        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            regenerate.mutate();
          }}
        >
          <p className="font-bold">Recovery codes</p>
          <p className="text-sm text-muted">
            {admin.recoveryCodesLeft} unused code{admin.recoveryCodesLeft === 1 ? '' : 's'} left (as of sign-in). New codes replace all the old ones.
          </p>
          <Field label="Authenticator code" required>
            {(p) => <Input {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} />}
          </Field>
          <InlineError error={regenerate.error} />
          <div>
            <Button type="submit" variant="secondary" loading={regenerate.isPending} disabled={code.replace(/\s/g, '').length !== 6}>
              Generate new recovery codes
            </Button>
          </div>
          {codes && (
            <div className="flex flex-col gap-2">
              <ul aria-label="New recovery codes" className="grid grid-cols-2 gap-2 border border-line bg-surface-2 p-4 font-mono text-sm font-bold rounded-control">
                {codes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="text-xs text-muted">Shown only now — save them somewhere safe.</p>
              <div>
                <CopyButton value={codes.join('\n')} label="Copy codes" />
              </div>
            </div>
          )}
        </form>
      </CardBody>
    </Card>
  );
}

export function PlatformSettingsView() {
  const settings = useQuery({ queryKey: platformKeys.settings, queryFn: () => api.get<PlatformSettings>('/platform/settings') });
  return (
    <>
      <PageHeader eyebrow="Platform console" title="Settings" description="Platform-wide notices, defaults for new schools, cost rates and your account." />
      {settings.isPending ? (
        <LoadingBlock />
      ) : settings.isError ? (
        <Card>
          <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <NoticesCard settings={settings.data} />
          <div className="grid gap-6 lg:grid-cols-2">
            <DefaultModelsCard settings={settings.data} />
            <PricesCard settings={settings.data} />
          </div>
          <AccountCard />
        </div>
      )}
    </>
  );
}

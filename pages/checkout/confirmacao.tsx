// pages/checkout/confirmacao.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

type StatusType = 'active' | 'waiting' | string;

export default function Confirmacao() {
  const router = useRouter();
  const { subscription_id, status, charge_id } = router.query;

  const [copied, setCopied] = useState(false);

  const subId = useMemo(() => {
    const raw = Array.isArray(subscription_id) ? subscription_id[0] : subscription_id;
    return raw ? String(raw) : '';
  }, [subscription_id]);

  const chargeId = useMemo(() => {
    const raw = Array.isArray(charge_id) ? charge_id[0] : charge_id;
    return raw ? String(raw) : '';
  }, [charge_id]);

  const paymentStatus: StatusType = useMemo(() => {
    const raw = Array.isArray(status) ? status[0] : status;
    return (raw ? String(raw) : '').toLowerCase();
  }, [status]);

  useEffect(() => {
    let t: any;
    if (copied) t = setTimeout(() => setCopied(false), 2000);
    return () => t && clearTimeout(t);
  }, [copied]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {}
  };

  const isMissingParams = !subId || !paymentStatus;

  const Message = () => {
    if (isMissingParams) {
      return (
        <p style={{ color: '#b42318' }}>
          Parâmetros ausentes. Volte e tente novamente ou entre em contato com o suporte.
        </p>
      );
    }

    if (paymentStatus === 'active') {
      return (
        <>
          <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Assinatura ativa 🎉</h2>
          <p style={{ margin: 0 }}>
            Sua assinatura foi criada e já está <b>ativa</b>. Enviamos a primeira cobrança para o cartão informado.
          </p>
        </>
      );
    }

    if (paymentStatus === 'waiting') {
      return (
        <>
          <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Estamos quase lá… ⏳</h2>
          <p style={{ margin: 0 }}>
            Recebemos sua assinatura, mas a primeira cobrança ainda está <b>em análise</b> ou{' '}
            <b>aguardando confirmação</b> do emissor do cartão. Isso costuma se resolver em alguns minutos.
          </p>
        </>
      );
    }

    return (
      <>
        <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Status recebido</h2>
        <p style={{ margin: 0 }}>
          O status da assinatura é: <b>{paymentStatus}</b>.
        </p>
      </>
    );
  };

  return (
    <>
      <Head>
        <title>Confirmação da assinatura</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Confirmação</h1>

          <div style={{ marginBottom: 16 }}>
            <Message />
          </div>

          {!isMissingParams && (
            <div style={styles.infoGrid}>
              <InfoRow label="Subscription ID">
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
                  {subId}
                </span>
                <button
                  onClick={() => copy(subId)}
                  style={styles.copyBtn}
                  title="Copiar"
                  aria-label="Copiar Subscription ID"
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </InfoRow>

              <InfoRow label="Status">{paymentStatus}</InfoRow>

              {chargeId && <InfoRow label="Charge ID">{chargeId}</InfoRow>}
            </div>
          )}

          {paymentStatus === 'waiting' && (
            <div style={styles.note}>
              <p style={{ margin: 0 }}>
                Caso não atualize em até 10 minutos, você pode <b>recarregar esta página</b>. Opcionalmente,
                implementamos um webhook que atualiza seu cadastro assim que o status mudar.
              </p>
            </div>
          )}

          <div style={styles.actions}>
            <a href="/" style={styles.btnSecondary}>Voltar ao início</a>
            {/* Trocar para o destino que fizer sentido no seu fluxo */}
            <a href="/minha-conta" style={styles.btnPrimary}>Ir para minha conta</a>
          </div>

          {/* Debug opcional */}
          <details style={{ marginTop: 16 }}>
            <summary>Detalhes técnicos</summary>
            <pre style={styles.pre}>
{JSON.stringify({ subscription_id: subId, status: paymentStatus, charge_id: chargeId }, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </>
  );
}

function InfoRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={styles.row}>
      <div style={styles.label}>{props.label}</div>
      <div style={styles.value}>{props.children}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg,#f8fafc 0%,#eef2f7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 720,
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
    padding: 24,
  },
  title: {
    margin: '0 0 8px',
    fontSize: 28,
    letterSpacing: -0.2,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
    marginTop: 8,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr auto',
    gap: 8,
    alignItems: 'center',
  },
  label: {
    fontWeight: 600,
    color: '#334155',
  },
  value: {
    color: '#0f172a',
    wordBreak: 'break-all',
  },
  copyBtn: {
    marginLeft: 8,
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    padding: '6px 10px',
    fontSize: 12,
    borderRadius: 8,
    cursor: 'pointer',
  },
  note: {
    marginTop: 12,
    border: '1px dashed #e2e8f0',
    background: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    color: '#334155',
  },
  actions: {
    display: 'flex',
    gap: 12,
    marginTop: 20,
  },
  btnPrimary: {
    display: 'inline-block',
    padding: '10px 14px',
    background: '#0ea5e9',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: 10,
    fontWeight: 600,
  },
  btnSecondary: {
    display: 'inline-block',
    padding: '10px 14px',
    background: '#e2e8f0',
    color: '#0f172a',
    textDecoration: 'none',
    borderRadius: 10,
    fontWeight: 600,
  },
  pre: {
    marginTop: 8,
    padding: 12,
    background: '#0b1220',
    color: '#e2e8f0',
    borderRadius: 10,
    overflow: 'auto',
  },
};

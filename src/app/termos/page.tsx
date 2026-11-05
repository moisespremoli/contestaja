import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Termos do serviço" };

export default function Termos() {
  return (
    <LegalPage title="Termos do serviço">
      <h2>1. Objeto</h2>
      <p>O ContestaJá é um serviço digital de preparação de documentos. Com base nos dados fornecidos pelo cliente, seleciona uma minuta previamente elaborada e gera um documento personalizado em PDF.</p>
      <h2>2. O que o serviço não inclui</h2>
      <ul>
        <li>Consulta ou patrocínio jurídico;</li>
        <li>Submissão do documento junto de qualquer entidade em nome do cliente;</li>
        <li>Garantia de deferimento da defesa ou de anulação da coima.</li>
      </ul>
      <h2>3. Responsabilidades do cliente</h2>
      <ul>
        <li>Fornecer dados verdadeiros, completos e atualizados;</li>
        <li>Verificar todo o conteúdo do documento antes de o assinar;</li>
        <li>Confirmar e cumprir os prazos legais indicados na notificação;</li>
        <li>Assinar e apresentar o documento à entidade competente.</li>
      </ul>
      <h2>4. Inexistência de minuta adequada</h2>
      <p>Se não existir uma minuta adequada ao caso, o cliente é informado e não é cobrado qualquer valor.</p>
      <h2>5. Pagamento e entrega</h2>
      <p>O documento é disponibilizado apenas após a confirmação do pagamento pelo prestador de pagamentos.</p>
    </LegalPage>
  );
}

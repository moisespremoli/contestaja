import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Política de privacidade" };

export default function Privacidade() {
  return (
    <LegalPage title="Política de privacidade">
      <p>Esta política explica como tratamos os dados pessoais recolhidos para a preparação do seu documento, nos termos do Regulamento Geral sobre a Proteção de Dados (RGPD).</p>
      <h2>Dados recolhidos</h2>
      <ul>
        <li>Identificação do requerente (nome ou denominação, NIF/NIPC, documento de identificação), morada e contactos;</li>
        <li>Identificação do representante legal, do titular do veículo e do condutor, quando aplicável;</li>
        <li>Dados da infração e documentos que decida carregar (notificação e documentos complementares);</li>
        <li>Dados de pagamento tratados pelo prestador de pagamentos (não guardamos dados de cartão).</li>
      </ul>
      <h2>Finalidade e fundamento</h2>
      <p>Os dados são tratados exclusivamente para a execução do contrato de prestação do serviço (preparação do documento), cumprimento de obrigações legais (faturação) e segurança da plataforma.</p>
      <h2>Segurança</h2>
      <p>Os dados do processo são encriptados, os documentos são guardados em armazenamento privado e o acesso é feito através de links pessoais e temporários. Todos os acessos administrativos são registados.</p>
      <h2>Conservação</h2>
      <p>Os dados e documentos são conservados durante o período necessário à prestação do serviço e eliminados ou anonimizados após o prazo de conservação definido, salvo obrigação legal em contrário.</p>
      <h2>Direitos</h2>
      <p>Pode exercer os direitos de acesso, retificação, apagamento, limitação, portabilidade e oposição através do contacto indicado no site, e apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD).</p>
    </LegalPage>
  );
}

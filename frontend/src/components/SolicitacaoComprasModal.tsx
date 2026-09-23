import React, { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { diaLocal } from "../lib/datas";
import { Button, Modal, ModalFooter } from "../design-system/ui";
import logo from "../assets/logo.png"; // ajuste o caminho se necessário

interface Produto {
  id: number;
  nome: string;
  codigo: string;
  saldo: number;
}

interface Solicitacao {
  id: number;
  quantidade: number;
}

interface Props {
  aberto: boolean;
  fechar: () => void;
  produtos: Produto[];
  solicitante: string;
}

const SolicitacaoComprasModal: React.FC<Props> = ({
  aberto,
  fechar,
  produtos,
  solicitante,
}) => {
  const [solicitacao, setSolicitacao] = useState<Solicitacao[]>([]);
  const [busca, setBusca] = useState("");

  const atualizarQuantidade = (id: number, quantidade: number) => {
    setSolicitacao((prev) => {
      const existe = prev.find((item) => item.id === id);
      if (existe) {
        return prev.map((item) =>
          item.id === id ? { ...item, quantidade } : item,
        );
      } else {
        return [...prev, { id, quantidade }];
      }
    });
  };

  const gerarPDF = () => {
    const doc = new jsPDF();

    // Cabeçalho com logo
    doc.addImage(logo, "PNG", 150, 10, 40, 20);

    doc.setFontSize(16);
    doc.text("Solicitação de Compras", 14, 20);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

    // Montar tabela
    const dadosTabela = solicitacao
      .filter((item) => item.quantidade > 0)
      .map((item) => {
        const produto = produtos.find((p) => p.id === item.id);
        return [
          produto?.codigo || "",
          produto?.nome || "",
          produto?.saldo ?? 0,
          item.quantidade,
        ];
      });

    autoTable(doc, {
      startY: 40,
      head: [["Código", "Produto", "Saldo Atual", "Quantidade Solicitada"]],
      body: dadosTabela,
      theme: "grid",
      styles: { fontSize: 10 },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        halign: "center",
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 25, halign: "center" }, // Código
        1: { cellWidth: 70, halign: "left" }, // Produto
        2: { halign: "center" }, // Saldo
        3: { halign: "center" }, // Quantidade
      },
    });

    // Rodapé
    doc.setFontSize(12);
    doc.text(
      `Solicitante: ${solicitante}`,
      14,
      doc.internal.pageSize.height - 10,
    );

    // Salvar
    doc.save(`solicitacao_compras_${diaLocal(new Date())}.pdf`);
    fechar();
  };

  const produtosFiltrados = produtos.filter((p) => {
    const termo = busca.toLowerCase();
    return (
      p.nome.toLowerCase().includes(termo) ||
      String(p.codigo).toLowerCase().includes(termo) // ✅ garante que funcione mesmo se for número
    );
  });

  // O PDF só leva o que tem quantidade: sem nenhuma, "Gerar PDF" baixava uma
  // solicitação só com o cabeçalho e fechava o modal.
  const temQuantidade = solicitacao.some((item) => item.quantidade > 0);

  if (!aberto) return null;

  // O `Modal` do design system, e não o `<div className="fixed inset-0">` que
  // estava aqui: aquele não tinha `role="dialog"` nem nome acessível, não
  // fechava com Escape e não prendia o foco — com o Tab, o teclado saía do
  // modal para a tabela de Estoque atrás da cortina. Fecha no ×, no Escape e
  // na cortina, como Cancelar.
  return (
    <Modal open onClose={fechar} title="Selecionar Produtos" size="xl">
      <input
        type="text"
        placeholder="Pesquisar produto..."
        // O placeholder some ao digitar e não é nome: sem isto, o leitor de
        // tela anunciava só "caixa de texto".
        aria-label="Pesquisar produto"
        className="mb-4 w-full rounded-lg border border-borda bg-surface px-3 py-2 text-conteudo placeholder-conteudo-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div className="max-h-64 divide-y divide-borda overflow-y-auto">
        {produtosFiltrados.map((produto) => (
          <div
            key={produto.id}
            className="flex items-center justify-between py-2 text-conteudo"
          >
            <span>
              <span className="font-medium">{produto.codigo}</span> -{" "}
              {produto.nome}{" "}
              <span className="text-sm text-conteudo-muted">
                (Saldo: {produto.saldo})
              </span>
            </span>
            <input
              type="number"
              min={0}
              // Sem nome, o leitor de tela anunciava uma "caixa numérica" por
              // produto, todas iguais.
              aria-label={`Quantidade de ${produto.nome}`}
              // Controlado pelo estado: não controlado, o produto que a busca
              // tirava da lista voltava com o campo vazio, e a quantidade
              // continuava indo para o PDF sem ninguém ver. Zero fica vazio.
              value={
                solicitacao.find((item) => item.id === produto.id)
                  ?.quantidade || ""
              }
              className="w-24 rounded-lg border border-borda bg-surface px-2 py-1 text-conteudo focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              onChange={(e) =>
                atualizarQuantidade(produto.id, Number(e.target.value))
              }
            />
          </div>
        ))}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={fechar}>
          Cancelar
        </Button>
        <Button variant="success" onClick={gerarPDF} disabled={!temQuantidade}>
          Gerar PDF
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default SolicitacaoComprasModal;

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "./Table";

describe("Table", () => {
  it("monta uma tabela de verdade, com papeis acessiveis", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Número</TableHeaderCell>
            <TableHeaderCell>Cliente</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>1500</TableCell>
            <TableCell>INTERCEMENT BRASIL S.A</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Número" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "1500" })).toBeInTheDocument();
  });

  it("o estado vazio fala em frase completa", () => {
    // O .d.ts declara TableEmpty como { colSpan, message? }, sem children —
    // a API não muda em relação ao original, então a mensagem custom vem
    // pela prop `message`, não como filho do componente.
    render(
      <Table>
        <TableBody>
          <TableEmpty colSpan={2} message="Nenhuma nota encontrada." />
        </TableBody>
      </Table>,
    );
    expect(screen.getByText("Nenhuma nota encontrada.")).toBeInTheDocument();
  });

  it("o estado vazio usa a frase padrão quando nenhuma mensagem é passada", () => {
    render(
      <Table>
        <TableBody>
          <TableEmpty colSpan={2} />
        </TableBody>
      </Table>,
    );
    expect(screen.getByText("Nenhum resultado encontrado.")).toBeInTheDocument();
  });
});

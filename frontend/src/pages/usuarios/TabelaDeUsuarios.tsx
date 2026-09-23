import { Lock, Pencil, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../../design-system/ui";
import type { Usuario } from "../../services/api";
import { dataDeCriacao, nomeDoPapel, tomDoPapel } from "./usuarios";

/**
 * As cinco colunas, na ordem. Nenhuma ordena, de propósito: esta é a única
 * tabela do sistema que é cadastro e não relatório — a lista é curta, vem
 * do backend na ordem do id, e uma seta em cada cabeçalho só convidaria a
 * mexer numa ordem que ninguém precisa mexer.
 */
const COLUNAS = ["ID", "Usuário", "E-mail", "Perfil", "Criado em", "Ações"];

export interface TabelaDeUsuariosProps {
  usuarios: Usuario[];
  /** Id de quem está logado — a linha dele ganha o "(você)" e não se exclui. */
  idDoLogado?: number | null;
  onEditar: (usuario: Usuario) => void;
  onTrocarSenha: (usuario: Usuario) => void;
  onExcluir: (usuario: Usuario) => void;
  onNovoUsuario: () => void;
}

interface LinhaDeUsuarioProps {
  usuario: Usuario;
  ehVoce: boolean;
  onEditar: () => void;
  onTrocarSenha: () => void;
  onExcluir: () => void;
}

/**
 * Botão de ação de linha: só o ícone, com o nome no `title` e no
 * `aria-label` — os dois com o mesmo texto, para o mouse e o leitor de tela
 * lerem a mesma coisa. Fica `ghost` para a linha não virar uma fileira de
 * botões coloridos; quem carrega a cor é o ícone.
 */
function AcaoDaLinha({
  rotulo,
  onClick,
  disabled,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="px-2"
      title={rotulo}
      aria-label={rotulo}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function LinhaDeUsuario({
  usuario,
  ehVoce,
  onEditar,
  onTrocarSenha,
  onExcluir,
}: LinhaDeUsuarioProps) {
  const papel = nomeDoPapel(usuario);

  return (
    <TableRow>
      <TableCell muted className="font-mono text-xs">
        {usuario.id}
      </TableCell>
      <TableCell className="font-medium">
        {usuario.username}
        {ehVoce ? (
          <span className="ml-2 text-xs font-normal text-conteudo-muted">
            (você)
          </span>
        ) : null}
      </TableCell>
      <TableCell muted>{usuario.email || "—"}</TableCell>
      <TableCell>
        <Badge variant={tomDoPapel(papel)} className="capitalize">
          {papel}
        </Badge>
      </TableCell>
      <TableCell muted className="whitespace-nowrap font-mono text-xs">
        {dataDeCriacao(usuario.created_at)}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-1">
          <AcaoDaLinha rotulo="Editar" onClick={onEditar}>
            <Pencil
              className="h-4 w-4 text-action"
              strokeWidth={2}
              aria-hidden="true"
            />
          </AcaoDaLinha>
          <AcaoDaLinha rotulo="Trocar senha" onClick={onTrocarSenha}>
            <Lock
              className="h-4 w-4 text-warning"
              strokeWidth={2}
              aria-hidden="true"
            />
          </AcaoDaLinha>
          <AcaoDaLinha
            rotulo={
              ehVoce ? "Não é possível excluir seu próprio usuário" : "Excluir"
            }
            disabled={ehVoce}
            onClick={onExcluir}
          >
            <Trash2
              className={
                ehVoce ? "h-4 w-4 text-conteudo-faint" : "h-4 w-4 text-danger"
              }
              strokeWidth={2}
              aria-hidden="true"
            />
          </AcaoDaLinha>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * A tabela de acessos — a tela inteira, fora o cabeçalho e os diálogos.
 *
 * Não guarda estado nenhum: recebe a lista pronta e devolve, por callback,
 * qual linha a pessoa quer editar, trocar a senha ou excluir. Quem decide o
 * que abrir é a tela.
 */
export function TabelaDeUsuarios({
  usuarios,
  idDoLogado,
  onEditar,
  onTrocarSenha,
  onExcluir,
  onNovoUsuario,
}: TabelaDeUsuariosProps) {
  return (
    <Card padding="none">
      <Table>
        <TableHead>
          <TableRow>
            {COLUNAS.map((rotulo) => (
              <TableHeaderCell
                key={rotulo}
                className={rotulo === "Ações" ? "text-center" : undefined}
              >
                {rotulo}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {usuarios.length === 0 ? (
            <TableEmpty
              colSpan={COLUNAS.length}
              message={
                <div className="flex flex-col items-center gap-3">
                  <p>Nenhum usuário cadastrado ainda.</p>
                  {/* Secundário, e com outro rótulo: o primário desta decisão
                      é o "Novo Usuário" do cabeçalho, que continua ali em
                      cima. Dois botões com o mesmo nome na mesma tela é o
                      tipo de coisa que faz a pessoa procurar a diferença. */}
                  <Button variant="secondary" size="sm" onClick={onNovoUsuario}>
                    Criar o primeiro usuário
                  </Button>
                </div>
              }
            />
          ) : (
            usuarios.map((usuario) => (
              <LinhaDeUsuario
                key={usuario.id}
                usuario={usuario}
                ehVoce={usuario.id === idDoLogado}
                onEditar={() => onEditar(usuario)}
                onTrocarSenha={() => onTrocarSenha(usuario)}
                onExcluir={() => onExcluir(usuario)}
              />
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

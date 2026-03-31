# cp-stash

CLI para empacotar arquivos de `git stash` e/ou mudanças locais em um arquivo `.zip`, preservando a estrutura original do repositório.

O comando principal é `cp-stash`. O pacote também publica o alias curto `cpzip`.

## O que ele faz

- Coleta arquivos de um `stash` específico
- Coleta arquivos modificados, staged e untracked do working tree
- Junta tudo em um `.zip` pronto para compartilhar ou arquivar
- Preserva os caminhos originais dos arquivos
- Exclui `.claude/` por padrão, com opção para incluir

## Instalação

### Rodar no projeto

```bash
bun install
```

### Instalar globalmente (habilita `cp-stash` no terminal)

```bash
bun install -g .
```

Depois:

```bash
cp-stash --help
```

### Build local

```bash
bun run build
```

### Desenvolvimento

```bash
bun run src/index.ts --help
```

Depois do build, o binário gerado fica em `dist/index.js`.

## Uso rápido

```bash
cp-stash
```

Isso gera um `.zip` com:

- arquivos do `stash@{0}`
- arquivos modificados
- arquivos staged
- arquivos untracked

O nome padrão do arquivo é:

```text
cp-stash-YYYY-MM-DDTHH-MM-SS.zip
```

## Comandos disponíveis

Este pacote publica dois comandos equivalentes:

```bash
cp-stash
cpzip
```

## Opções

| Opção | Descrição |
| --- | --- |
| `--stash` | Inclui apenas arquivos do stash |
| `--modified` | Inclui apenas arquivos modificados, staged e untracked |
| `--all` | Inclui stash + working tree. É o padrão |
| `stash@{N}` | Seleciona qual stash usar. O padrão é `stash@{0}` |
| `-o`, `--output` | Define o nome do arquivo `.zip` de saída |
| `--with-claude` | Inclui arquivos dentro de `.claude/` |
| `--help`, `-h` | Mostra a ajuda |

## Exemplos

Empacotar stash + mudanças locais:

```bash
cp-stash
```

Empacotar apenas arquivos modificados:

```bash
cp-stash --modified
```

Empacotar apenas um stash específico:

```bash
cp-stash --stash stash@{2}
```

Gerar um zip com nome customizado:

```bash
cp-stash -o review-files.zip
```

Usar o alias curto:

```bash
cpzip --modified -o hotfix.zip
```

Incluir `.claude/` no pacote:

```bash
cp-stash --with-claude
```

## Comportamento

- O comando precisa ser executado dentro de um repositório Git
- Se não houver arquivos elegíveis, ele encerra sem gerar `.zip`
- Arquivos que não existirem mais no disco são ignorados com aviso
- Se o arquivo de saída estiver dentro do repositório, ele não é incluído no próprio zip

## Desenvolvimento

Scripts disponíveis:

```bash
bun run dev
bun run build
```

Estrutura principal:

```text
src/index.ts   # entrada do CLI
dist/index.js  # saída do build
```

## Requisitos

- [Bun](https://bun.com)
- Git disponível no ambiente

## Licença

MIT

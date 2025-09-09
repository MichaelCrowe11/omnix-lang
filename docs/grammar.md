# OMNIX Language Grammar v0.1

## EBNF Specification

This document defines the formal grammar for OMNIX v0.1 using Extended Backus-Naur Form (EBNF).

### Program Structure

```ebnf
program        := (annotation | decl | func | cluster | node)* ;
annotation     := "@" ident "(" param_list? ")" ;
param_list     := param ("," param)* ;
param          := ident ":" expr ;
```

### Distributed Constructs

```ebnf
cluster        := "consensus" "cluster" ident "{" cluster_item* "}" ;
cluster_item   := ("replicas:" number) 
                | ("consensus:" ident) 
                | ("zones:" array) 
                | annotation 
                | state 
                | func 
                | service ;

node           := annotation* "node" ident "{" node_item* "}" ;
node_item      := annotation | state | func | rpc | event_handler ;
```

### State and Functions

```ebnf
state          := annotation* "state" ident ":" type ("=" expr)? ";" ;
func           := "function" ident "(" params? ")" ("->" type)? block ;
service        := "service" ident "(" params? ")" ("->" type)? block ;
rpc            := annotation* "function" ident "(" params? ")" ("->" type)? block ;
params         := param_decl ("," param_decl)* ;
param_decl     := ident ":" type ;

event_handler  := "on" ident "(" params? ")" block ;
```

### Statements and Control Flow

```ebnf
block          := "{" stmt* "}" ;
stmt           := let_stmt 
                | assign 
                | call ";" 
                | when 
                | phase
                | emit ";" 
                | return ";"
                | expr_stmt ";" ;

let_stmt       := "let" ident "=" expr ";" ;
assign         := lvalue op_assign expr ";" ;
op_assign      := "<#>" | "=" ;        (* merge or set *)

when           := "when" expr block ;
phase          := "phase" ident block ;
emit           := "broadcast" "(" expr ")" ;
return         := "return" expr? ;
expr_stmt      := expr ;
```

### Expressions

```ebnf
expr           := proposal | vote | query | binary | primary ;
proposal       := expr "<!>" consensus_opts ;
vote           := expr "<?>" consensus_opts ;
query          := expr "<@>" query_opts ;
consensus_opts := "{" (param ("," param)*)? "}" ;
query_opts     := "{" (param ("," param)*)? "}" ;

binary         := expr op expr ;
op             := "+" | "-" | "*" | "/" 
                | "==" | "!=" | ">" | "<" | ">=" | "<="
                | "&&" | "||" ;

primary        := number 
                | string 
                | boolean
                | ident 
                | call 
                | array 
                | object 
                | "(" expr ")" ;

call           := ident "(" (expr ("," expr)*)? ")" ;
```

### Literals and Collections

```ebnf
array          := "[" (expr ("," expr)*)? "]" ;
object         := "{" (object_field ("," object_field)*)? "}" ;
object_field   := ident ":" expr ;

number         := digit+ ("." digit+)? ;
string         := '"' char* '"' ;
boolean        := "true" | "false" ;
ident          := letter (letter | digit | "_")* ;
```

### Types

```ebnf
type           := primitive_type | generic_type | array_type ;
primitive_type := "u64" | "i64" | "f64" | "bool" | "String" | "Bytes" ;
generic_type   := ident ("<" type ("," type)* ">")? ;
array_type     := "Vec" "<" type ">" | "Set" "<" type ">" | "Map" "<" type "," type ">" ;
```

### Lexical Elements

```ebnf
letter         := "a" | "b" | ... | "z" | "A" | "B" | ... | "Z" ;
digit          := "0" | "1" | ... | "9" ;
char           := any_unicode_character_except_quote_or_backslash | escape_sequence ;
escape_sequence := "\" ("n" | "t" | "r" | "\" | '"') ;
```

### Comments

```ebnf
comment        := "//" any_char_until_newline | "/*" any_char_until_close_comment "*/" ;
```

## Consensus Operators

### Core Operators

- **`<!>`** (Propose): Submit a value to the consensus protocol
  ```omx
  let result = value <!> {
      validators: 3,
      timeout: 2000ms,
      algorithm: Consensus::Raft
  };
  ```

- **`<?>`** (Vote): Participate in voting on a proposal (reserved for future use)

- **`<#>`** (Merge): Apply consensus-safe merge into replicated state
  ```omx
  counter <#> new_value;
  ```

- **`<@>`** (Query): Query distributed state or metadata (reserved for future use)

### Consensus Options

Common parameters for consensus operations:
- `validators`: Number of required validator nodes
- `timeout`: Operation timeout in milliseconds
- `algorithm`: Consensus algorithm (`Consensus::Raft`, `Consensus::PBFT`, etc.)
- `quorum`: Minimum quorum size

## Annotations

### Node Annotations
- `@network(port: u16, discovery: DiscoveryMethod)`
- `@byzantine(f: u32, n: u32)` - Byzantine fault tolerance parameters

### State Annotations
- `@replicated` - Mark state as distributed and replicated
- `@persistent` - Mark state as persistent across restarts

### Function Annotations
- `@rpc` - Expose function as RPC endpoint
- `@atomic` - Ensure atomic execution across replicas

## Example Grammar Usage

```omx
@network(port: 8080, discovery: mDNS)
node CounterNode {
    @replicated
    state counter: u64 = 0;

    function increment() {
        let proposal = counter + 1;
        let result = proposal <!> {
            validators: 3,
            timeout: 2000ms,
            algorithm: Consensus::Raft
        };
        
        when result.accepted() {
            counter <#> result.value;
            broadcast(CounterUpdate(counter));
        }
    }

    @rpc
    function get_value() -> u64 {
        return counter;
    }
}
```

## Reserved Keywords

Core language keywords:
- `node`, `cluster`, `consensus`, `function`, `service`
- `state`, `let`, `when`, `phase`, `return`
- `true`, `false`, `if`, `else`, `loop`, `for`, `while`
- `broadcast`, `on`

Type keywords:
- `u64`, `i64`, `f64`, `bool`, `String`, `Bytes`
- `Vec`, `Set`, `Map`, `Option`, `Result`

Consensus keywords:
- `algorithm`, `validators`, `timeout`, `quorum`
- `Raft`, `PBFT`, `Tendermint`

## Grammar Extensions (Future)

The grammar is designed to be extensible for future features:
- Contract definitions and cross-chain operations
- Advanced query patterns with `<@>` operator
- Subscription mechanisms with `<~>` operator
- Handshake protocols with `<=>` operator
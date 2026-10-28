// Traductores y extensiones del navegador mueven nodos que React cree suyos; cuando React
// intenta sacarlos o insertar junto a ellos, el DOM tira "insertBefore"/"removeChild" y la
// vista se cae. Si el nodo ya no está donde React espera, se ignora en lugar de romper.
const { removeChild, insertBefore } = Node.prototype

Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
  if (child.parentNode !== this) return child
  return removeChild.call(this, child) as T
}

Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
  if (ref && ref.parentNode !== this) return insertBefore.call(this, node, null) as T
  return insertBefore.call(this, node, ref) as T
}

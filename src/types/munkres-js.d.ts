declare module "munkres-js" {
  /**
   * Solves the linear sum assignment problem (minimisation).
   * Returns [row, column] index pairs.
   */
  function munkres(costMatrix: number[][]): [number, number][];
  export = munkres;
}

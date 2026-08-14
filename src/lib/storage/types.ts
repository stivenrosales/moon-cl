/**
 * Contrato mínimo de storage: subir, borrar y resolver URL pública.
 *
 * Cualquier proveedor S3-compatible (R2 hoy, MinIO en el VPS más adelante)
 * lo implementa sin que el código de dominio sepa cuál es — migrar de
 * proveedor debe ser cambiar variables de entorno, no reescribir esto.
 */
export interface StorageAdapter {
  /**
   * URL firmada de subida directa (PUT). El archivo nunca pasa por nuestro
   * servidor: el cliente hace el PUT directo contra el storage.
   *
   * contentLength no es cosmético: SigV4 lo incluye entre los headers
   * firmados, así que el proveedor solo acepta el PUT si el Content-Length
   * real del body coincide exactamente con este valor. Sin esto, el límite
   * de tamaño era solo un chequeo del lado del cliente — cualquiera podía
   * ignorar el `size` declarado y subir lo que quisiera con la URL firmada.
   */
  crearUrlDeSubida(input: { key: string; contentType: string; contentLength: number }): Promise<string>;
  /** Borra un objeto por su key. No lanza si el objeto ya no existe. */
  borrar(key: string): Promise<void>;
  /** URL pública de lectura para un objeto ya subido. */
  resolverUrlPublica(key: string): string;
}

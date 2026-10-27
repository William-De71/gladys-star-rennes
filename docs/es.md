# STAR Rennes

## Presentación

Esta integración lleva a Gladys el **STAR**, la red de autobuses y metro de Rennes Métropole: los **próximos pasos en tiempo real** en las paradas que elijas (tres en el formulario, hasta 20 más con un botón), filtrados por línea y dirección, con el **retraso** del próximo autobús; el **tráfico** de hasta seis líneas, de autobús o de metro (normal, incidencia leve, importante o bloqueante, metro averiado, con los avisos del STAR); y el **estado del metro**: sus dos líneas, las estaciones cerradas y los ascensores y escaleras mecánicas fuera de servicio. Cada parada y cada línea se convierte en un dispositivo que puedes mostrar en un panel y usar en escenas.

Los datos vienen del **portal oficial de datos abiertos del STAR** (Keolis Rennes, para Rennes Métropole), bajo licencia ODbL: sin cuenta ni clave. Las paradas se leen cada minuto por defecto (cada 10 minutos mientras una parada no anuncia nada, de noche), el tráfico y el metro cada 5 minutos. Las líneas y paradas de la red las guarda la integración y las vuelve a leer una vez al día y una vez a la semana.

Es una integración **cloud**: contacta con `data.explore.star.fr`. Nada más sale de tu red.

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- Nada más: los datos abiertos del STAR no necesitan ni cuenta ni clave.

## Configuración

| Campo                  | Qué escribir                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parada 1, 2, 3         | El nombre de la parada («République», «Gares») para todos los lados de la calle y la estación de metro, o un identificador («1242») para un lado o un andén. |
| Línea                  | Solo esta línea: «C1», «11», «a» o «b» para el metro. Vacío: todas las líneas de la parada.                                                                  |
| Dirección              | Solo los destinos que contienen estas palabras: «Chantepie», «Poterie \| Gaîté». Vacío: ambos sentidos.                                                      |
| Líneas seguidas        | Las líneas cuyo tráfico sigues, hasta seis: «a, b, C1, 11».                                                                                                  |
| Lectura de las paradas | Cada 30 segundos, cada minuto, cada 2 minutos o cada 5 minutos.                                                                                              |
| Idioma de los textos   | Nombres de los dispositivos, resúmenes y salidas de las escenas. Los nombres de las paradas y los avisos del STAR quedan en francés.                         |

El botón **Buscar una parada** da los nombres exactos de las paradas que contienen algunas palabras, con el identificador de cada lado de la calle y de cada andén de metro, y las líneas y destinos anunciados allí («1242 → 11 La Poterie, C1 Chantepie»): copia el identificador del lado donde subes. **Probar la conexión** lee la red, cada parada y cada línea al momento, y las llamadas que quedan hoy.

Más paradas que las tres del formulario (casa, trabajo…): **Añadir una parada** usa los mismos tres campos — parada, línea, dirección — y sigue hasta 20 paradas más. **Listar las paradas** muestra todas las paradas seguidas, numeradas; **Quitar una parada** toma ese número (o el nombre). Las paradas añadidas se guardan en la configuración de Gladys, así que entran en sus copias de seguridad.

Sin clave, el portal permite un número de llamadas por día y por dirección de internet (20 000 cuando se escribió esta integración). Con muchas paradas, la integración las lee con menos frecuencia para quedarse muy por debajo, y lo indica en su estado.

## Uso

### Dispositivos

En la pestaña **Descubrir**, crea los dispositivos que quieras:

- **STAR \<parada\>**: el próximo paso como texto («C1 → Chantepie · 6 min (+1 min de retraso)»), la espera del próximo paso y del siguiente, y el retraso del próximo autobús respecto a su horario (minutos);
- **STAR línea \<línea\>** o **STAR metro \<línea\>**: el tráfico como texto («Incidencia importante: Travaux») y el número de incidencias importantes o bloqueantes en curso.

Cuando un autobús aún no está localizado, el STAR da su horario teórico: la integración lo indica («horario teórico»). De noche, sin ningún paso, las esperas conservan su último valor.

### Widgets del panel

![El widget Salidas STAR en République, el widget Tráfico STAR de cuatro líneas y el widget Metro STAR (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-star-rennes/main/docs/assets/widgets.es.png)

- **Salidas STAR**: los próximos pasos de una parada, en formato compacto: una fila por línea y destino con sus próximos pasos seguidos («1 · 9 · 27 min», «10:32»), los horarios teóricos en gris. El ajuste **Trayectos mostrados** fija el número de filas. Elige una parada seguida, o escribe cualquier parada (y una línea) en los ajustes del widget. Con **Varias paradas**, un solo widget muestra varios dispositivos de parada: los dispositivos de una misma parada se agrupan bajo su nombre; para paradas distintas, cada fila empieza por su parada.
- **Tráfico STAR**: el estado de cada línea y después los avisos del STAR con sus fechas; toca una tarjeta para ver el texto completo y el enlace a star.fr. Las líneas seguidas, o las escritas en los ajustes.
- **Metro STAR**: las líneas a y b (en servicio, o averiadas con la reanudación prevista), las estaciones cerradas y después los ascensores y escaleras mecánicas fuera de servicio, estación por estación. El ajuste **Equipos mostrados** permite quedarse solo con los ascensores, por ejemplo.

### Escenas

Disparadores, una vez por cambio (la primera lectura solo sirve de referencia):

- **STAR: autobús o metro pronto**: un paso en una parada seguida sale dentro de 2, 3, 5, 10, 15 o 20 minutos.
- **STAR: línea con incidencias**: una línea seguida recibe un aviso importante o bloqueante en curso, o su metro se avería.
- **STAR: línea vuelve a la normalidad**: vuelve a circular con normalidad.
- **STAR: nuevo aviso de tráfico**: el STAR publica un aviso sobre una línea seguida (previsto o en curso).
- **STAR: ascensor del metro averiado** y **STAR: ascensor del metro reparado**: un ascensor o una escalera mecánica de una estación de metro (o de su aparcamiento disuasorio), filtrable por estación y tipo. No hace falta seguir ninguna línea.

Cada uno da una frase lista para usar, `{{triggerEvent.data.summary}}`, y sus valores (línea, destino, hora, retraso, título, estación…). Las acciones **STAR: próximos pasos** y **STAR: tráfico de una línea** devuelven el mismo tipo de valores, para ponerlos en un mensaje o comprobarlos en una condición.

Ejemplos:

- Cuando el C1 hacia Chantepie sale de République dentro de 5 minutos → encender en verde la lámpara de la entrada.
- Cuando el ascensor de tu estación de metro se avería → enviar el resumen a tu teléfono antes de salir.
- Cada día laborable a las 7:30 → leer los próximos pasos de tu parada y hacer que los anuncie el altavoz de la cocina.

### Transporte

Solo cloud: los datos vienen de internet. Solo se piden al portal del STAR las paradas y líneas que sigues.

## Solución de problemas

- **«Desconocido para STAR»**: usa **Buscar una parada** y copia el nombre exacto o un identificador; para una línea, su nombre como en los autobuses («C1», «11»), «a» o «b» para el metro.
- **Ningún paso de noche**: la red duerme; la parada se lee cada 10 minutos hasta que se anuncia el primer paso.
- **«Cuota diaria del portal de datos abiertos de STAR alcanzada»**: demasiadas llamadas hoy desde tu dirección de internet (otros programas pueden compartirla); las lecturas se reanudan tras la medianoche (UTC). Sigue menos paradas, o léelas con menos frecuencia.
- **«El portal de datos abiertos de STAR no responde»**: la integración vuelve a intentarlo en cada lectura; los últimos pasos siguen en los widgets.
- **Para informar de un problema**: pulsa **Diagnóstico** y copia las líneas que empiezan por «STAR diagnostic» de la pestaña Registros en una issue de GitHub o una respuesta en el foro, con las versiones de Gladys y de la integración.

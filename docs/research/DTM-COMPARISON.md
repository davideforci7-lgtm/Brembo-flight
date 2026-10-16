# DTM Lombardia 5 m / TINITALY: decisione conservativa

Verifica 16 ottobre 2026. **Nessuna sostituzione del terreno o delle collisioni.** L'evidenza è sufficiente a rilevare differenze, non a certificarne la causa o correggerle con un offset.

## Fonti e riferimento verticale

- [TINITALY, articolo originale INGV, 2007](https://tinitaly.pi.ingv.it/data/pdf/2007-ANNGEO-TINITALY01_compress.pdf), sezioni 2.1 e 3, pp. 411/413: quote riferite al livello medio del mare (MSL); non quote ellissoidiche. Tabella III, p. 416: Lombardia RMSE 3,68 m extraurbano / 4,83 m urbano. Sono statistiche storiche regionali del TIN originale, **non precisione certificata della tessera 1.1 o del centro di Brembilla**. [Edizione 1.1, INGV](https://tinitaly.pi.ingv.it/): raster nativo 10 m, campionato a 20 m nel gioco, CC BY 4.0. Il modello geoidico/realizzazione verticale del file locale 1.1 non è identificato: la dicitura MSL non basta per una trasformazione GNSS rigorosa.
- [DTM5 Lombardia, metadati del prodotto](https://www.geoportale.regione.lombardia.it/en/metadati?_detailSheetMetadata_WAR_gptmetadataportlet_identifier=r_lombar%3Adfc98d60-5f02-4a2b-8113-5ad24cc53a9c&_jsfBridgeRedirect=true&p_p_id=detailSheetMetadata_WAR_gptmetadataportlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal): edizione 2015, pixel 5 m, fonti miste; accuratezze dichiarate legate alla scala DBT: 0,30 m a 1:2.000, 1 m a 1:5.000, 2 m a 1:10.000. Non dimostrano quale classe copra ciascun pixel campionato. Il metadato identifica UTM/WGS84 ma **non una realizzazione verticale verificabile**. Licenza corrente CC BY 4.0.

Non assegnare arbitrariamente EGM96, EGM2008, ITALGEO2005 o EPSG:5705. Nessuna trasformazione verticale eseguita.

## Confronto numerico riproducibile

[81 campioni originali e differenze](dtm5-centre-samples.json): griglia 9×9, passo 100 m, centro ±400 m. ArcGIS `identify` restituisce l'attributo numerico `Stretch.Pixel Value`, non il colore di una hillshade. TINITALY confrontato nei corrispondenti vertici della griglia di gioco, riportando H con origine 400 m.

| DTM5 meno TINITALY di gioco | Metri |
| --- | ---: |
| Media | −3,979 |
| Mediana | −4,018 |
| RMSE delle differenze | 7,957 |
| Minimo / massimo | −27,963 / +8,188 |
| Percentile 95 dello scarto assoluto | 15,049 |

Non sono errori rispetto a verità a terra. Scala, interpolazione, epoca, punto/cella e datum possono contribuire; non attribuiamo automaticamente tutto allo scarto verticale. Campionamento sparso, non raster completo e non confronto su soli punti di suolo nudo verificati.

Rigenerazione offline: `python scripts/geo/compare-dtm-samples.py --cached docs/research/dtm5-centre-samples.json --output /tmp/dtm-comparison.json`. Omettere `--cached` interroga il servizio pubblico (due richieste concorrenti, retry limitati).

Il download regionale ufficiale `https://www.cartografia.servizirl.it/download/DTM5_RL.zip` è di 3.085.490.651 byte. Il precedente tentativo si è interrotto a 871.268.352 byte: **non acquisizione completa**. Header IMG estratto: Float32, EPSG:32632, griglia 46.533×44.400 a 5 m; nessun datum verticale nei tag osservati. Il file ausiliario IGE resta necessario per leggere il raster. Non conserviamo gigabyte parziali come se fossero un prodotto utilizzabile.

## Condizione per riprendere

Ottenere specifica verticale del prodotto DTM5 e della tessera TINITALY 1.1, verificare un piccolo ritaglio raster numerico completo e almeno tre checkpoint indipendenti distribuiti (più controlli per un settore intero). Solo allora decidere trasformazione, ricampionamento e sostituzione simultanea di mesh/collisioni. Una richiesta al fornitore non è stata inviata.

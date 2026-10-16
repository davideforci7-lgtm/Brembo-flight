# Campione DBGT del centro di Brembilla

Fonte: Regione Lombardia, Tema Edificato DBGT, CC BY 4.0 ([metadati](https://www.geoportale.regione.lombardia.it/metadati?_detailSheetMetadata_WAR_gptmetadataportlet_identifier=r_lombar%3A3493af32-587c-4bca-92a4-ea717ea1a617&_jsfBridgeRedirect=true&p_p_id=detailSheetMetadata_WAR_gptmetadataportlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal)). Attribuzione: Fonte Informativa: Regione Lombardia – D.G. Territorio e Sistemi verdi – Struttura giuridico per il territorio, rigenerazione urbana e sviluppo dell'infrastruttura dati territoriali.

`centre-2019-retrieved-2026-10-16.json` è la risposta pubblica originale, senza dati di Bruno. 475 unità che intersecano l'inviluppo E545880–546680 / N5074040–5074840, EPSG:32632 (800×800 m). Geometrie restituite nel CRS nativo EPSG:7791, con Z. Nessuna risposta troncata. Hash nel pacchetto `public/geo/brembilla-centro/dbgt-heights.json`.

Endpoint: `https://www.cartografia.servizirl.it/arcgis5/rest/services/BaseMap/DBGT_Tema0201_Edificato/MapServer/0/query`

Parametri: `f=json`, `where=1=1`, `geometry=545880,5074040,546680,5074840`, `geometryType=esriGeometryEnvelope`, `inSR=32632`, `spatialRel=esriSpatialRelIntersects`, `outSR=7791`, `outFields=OBJECTID,CLASSID,DATA_FIN,DATA_INI,FONTE,SCALA,UN_VOL_AV,UN_VOL_EX,UN_VOL_QE,UN_VOL_POR,CEDIUV`, `returnGeometry=true`, `returnZ=true`, `resultRecordCount=2000`, `orderByFields=OBJECTID`. Una ripetizione futura può differire: la risposta archiviata permette di riprodurre questo incremento senza rete.

## Confronto e decisione

Tutti i 475 record: inizio validità 2019-01-01, scala codificata 04 (1:2.000), `UN_VOL_EX=01` (estrusione in quota). **È diverso dal precedente campione periferico del 2011 con EX02.** Non confondere `DATA_INI` con data certificata di ripresa né la revisione del catalogo 2025 con quella di ogni edificio.

- 391 unità intersecano una sagoma OSM; 84 no. Nessuna assenza automaticamente interpretata come edificio nuovo/demolito.
- Solo 36 accettate: IoU almeno 0,80, distanza centroidi al massimo 3 m, porzione al suolo, associazione non ambigua, nessuna altezza esplicita OSM da sovrascrivere.
- Nessuna deformazione, snapping o correzione arbitraria: trasformazione PROJ EPSG:7791→32632 senza ballpark, accuratezza dichiarata operazione 1 m. Non misura la precisione delle sagome.
- Importato soltanto `UN_VOL_AV`, altezza relativa del volume. `UN_VOL_QE` e le Z originali **non** sommate al terreno; datum verticale non risolto. La base TINITALY e le sagome OSM sono conservate.
- Differenze rispetto ai valori precedenti: −5,30 / +8,44 m, mediana +1,0025 m. Questi sono scarti tra rappresentazioni, non errori di rilievo certificati.
- Materiali, finestre e forma piatta dei tetti restano illustrativi. L'associazione non prova che un edificio sia immutato dal 2019; occorre il controllo fotografico di Bruno.

Il rapporto `height-comparison.json` conserva tutte le associazioni candidate e i motivi di esclusione. Il JSON di runtime contiene i valori/sagome precedenti: viene rifiutato interamente se non coincide più con la base. Rendering e collisioni applicano la medesima funzione; errore di download → fallback originale. Nessun file di tessera/collisione OSM originale sovrascritto. L'associazione derivata usa ODbL 1.0 per la componente OSM e conserva attribuzione/licenza CC BY 4.0 dei valori DBGT; la risposta DBGT separata rimane CC BY 4.0.

Rigenerazione per sviluppatori (dipendenze in `scripts/photo/requirements.txt`):

```sh
python scripts/geo/prepare-dbgt-heights.py --source docs/research/dbgt/centre-2019-retrieved-2026-10-16.json --output public/geo/brembilla-centro/dbgt-heights.json --report docs/research/dbgt/height-comparison.json
```

## Missione 2: riesame esaustivo dei casi esclusi

[Rapporto per tutti i 475 volumi](excluded-review.json), rigenerabile con `python scripts/geo/audit-dbgt-associations.py --output /tmp/dbgt-review.json`. Non modifica il pacchetto di runtime.

| Classificazione primaria, esclusiva | Volumi |
| --- | ---: |
| Altezza relativa già accettata | 36 |
| Volume contenuto in una sagoma OSM più grande | 180 |
| Differenza di contorno/posizione | 153 |
| Nessuna sovrapposizione OSM, dopo verifica porzione/altezza | 80 |
| Sagoma OSM parte di un volume più grande | 15 |
| Porzione non al suolo | 6 |
| Sovrapposizione significativa con più sagome OSM | 3 |
| Altezza relativa fuori dai limiti accettati | 2 |

Totale 475, esclusi 439. I precedenti 84 senza overlap includono quattro casi ora classificati prima per porzione/altezza: non sono nuovi dati. Tutti i `DATA_FIN` sono null; `DATA_INI` rimane una validità, non prova dell'aspetto odierno.

Raggruppate le unità attraverso il legame DBGT `CEDIUV`: 83 gruppi con più volumi. **14 unioni** superano gli stessi controlli di sagoma/centroide, ma **nessuna** ha altezze uniformi entro 0,10 m. Una singola estrusione sarebbe quindi inferita. Non mediare le altezze, non usare il massimo su tutto l'edificio e non importare le parti come edifici sovrapposti. I 36 aggiornamenti rimangono invariati, come sagome, basi e collisioni.

La classificazione prepara la revisione, non dimostra demolizioni o errori di OSM/DBGT. Per ampliare l'importazione: confrontare prima uno dei 14 gruppi con foto di Bruno e definire basi/quote affidabili per ogni sottovolume. I test verificano che ogni volume sia contabilizzato una volta e che il riesame non modifichi i dati distribuiti.

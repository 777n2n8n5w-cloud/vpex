# VPEX Sans

`vpex-sans.woff2` is VPEX's house typeface: a web subset (Latin) of **Mona Sans** by the Mona Sans Project Authors
(https://github.com/github/mona-sans), variable in width (75–125%) and weight (200–900), with tabular figures.

Mona Sans is licensed under the SIL Open Font License 1.1 (`OFL-mona-sans.txt`). Because subsetting makes a
Modified Version and the license reserves the name "Mona", this cut is renamed VPEX Sans. The font may be used,
bundled and redistributed under the same license.

Rebuild: fontTools `pyftsubset "MonaSans[wdth,wght].ttf" --flavor=woff2` with the Latin unicode range and the
`tnum, pnum, case, frac, numr, dnom, sups, subs, ordn, ss01–ss08` features, then rename the name table to VPEX Sans.

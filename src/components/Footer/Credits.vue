<template>
  <div class="content">
    <h1>Quellen & Bildrechte</h1>

    <section>
      <h2>1. Icons</h2>
      <p>
        Manche verwendeten Icons stammen von
        <a href="https://icons8.com/" target="_blank" rel="noopener noreferrer"> Icons8 </a>.
      </p>
    </section>

    <section>
      <h2>2. Hinweise zur Nutzung</h2>
      <p>
        Alle verwendeten Medien werden unter Beachtung der jeweiligen Lizenzbedingungen eingesetzt.
        Sollte ein Rechteinhaber mit der Nutzung nicht einverstanden sein, bitten wir um
        Kontaktaufnahme.
      </p>
    </section>
  </div>
</template>

<style scoped lang="scss">
.content {
  color: white;
  text-align: left;
  padding: 6vh 10vw;
  max-width: 900px;
  margin: 0 auto;

  h1 {
    text-align: center;
    margin-bottom: 4vh;
    font-family: 'Metal Mania', cursive;
    color: #78ffc8;
    letter-spacing: 0.1em;
  }

  h2 {
    margin-top: 3vh;
    color: #78ffc8;
    font-size: 1.2rem;
  }

  p,
  li {
    line-height: 1.6;
    opacity: 0.9;
  }

  a {
    color: #78ffc8;
    text-decoration: underline;

    &:hover {
      opacity: 0.8;
    }
  }

  ul {
    padding-left: 1.2rem;
  }
}
</style>

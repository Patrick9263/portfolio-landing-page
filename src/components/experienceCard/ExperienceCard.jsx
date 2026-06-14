import './ExperienceCard.css'

const logoImages = import.meta.glob('../../images/logos/*.{png,jpg,jpeg,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const getCompanyLogo = (company) => {
  const logoName = company.replace(/ /g, '').toLowerCase()
  return (
    logoImages[`../../images/logos/${logoName}.png`] ||
    logoImages[`../../images/logos/${logoName}.jpg`] ||
    logoImages[`../../images/logos/${logoName}.jpeg`] ||
    logoImages[`../../images/logos/${logoName}.svg`]
  )
}

const ExperienceCard = ({ experience, companyColor = 'white' }) => {
  const { company, title, dateFrom, dateTo, info, stack } = experience
  const logoSrc = getCompanyLogo(company)

  return (
    <div className="experience-link">
      <div className="experience-card-wrapper">
        <div className="experience-card">
          <div className="experience-card-top">
            <div
              className="experience-bg"
              style={{ background: experience.colourPrimary }}
            ></div>

            <div className="container">
              <h2 style={{ color: companyColor }}>{company}</h2>
            </div>

            <div className="image-wrapper">
              <div
                className="experience-bg logo-bg"
                style={{
                  background: experience.colourSecondary
                    ? experience.colourSecondary
                    : experience.colourPrimary,
                }}
              ></div>

              {logoSrc ? (
                <img
                  className="company-logo"
                  src={logoSrc}
                  alt={`${company}-logo`}
                  style={
                    experience.logoheight
                      ? {
                          height: `${experience.logoheight}%`,
                        }
                      : { width: `${experience.logowidth}%` }
                  }
                />
              ) : null}
            </div>
          </div>

          <div className="experience-card-bottom">
            <div>
              <h2>{title}</h2>
              <h3>
                {dateFrom} - {dateTo}
              </h3>

              <ul className="experience-card-bullet-list">
                {info.map((point, idx) => (
                  <li
                    key={`${company}-point-${idx}`}
                    className="experience-card-bullet"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="experience-card-tech">
              <ul>
                {stack.map((tech) => (
                  <li key={`${company}-${tech}`}>{tech}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExperienceCard

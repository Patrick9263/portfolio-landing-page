import './MobileNav.css'

const MobileNav = ({ links, onNavigate, visible }) => {
  return (
    <div className="mobilenav-wrapper" id="mobile-navigation" hidden={!visible}>
      <ul className="mobilenavlinks">
        {links.map(({ href, label }) => (
          <li className="mobilenavlink" key={href}>
            <a href={href} onClick={onNavigate}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default MobileNav

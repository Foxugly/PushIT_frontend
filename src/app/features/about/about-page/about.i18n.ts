import { LanguageCode } from '../../../core/services/public-i18n.service';

export interface AboutTechCard {
  title: string;
  description: string;
  items: string[];
}

export interface AboutLegalSection {
  title: string;
  content: string[];
}

export interface AboutCopy {
  tabs: { company: string; legal: string; technical: string };
  companyTitle: string;
  companyIntro: string;
  company: {
    companyLabel: string;
    vatLabel: string;
    addressLabel: string;
    emailLabel: string;
    emailButton: string;
    phoneLabel: string;
    websiteLabel: string;
  };
  legalTitle: string;
  legalIntro: string;
  legalSections: AboutLegalSection[];
  technicalTitle: string;
  technicalIntro: string;
  repositoryUrlLabel: string;
  cards: {
    repository: AboutTechCard;
    backend: AboutTechCard;
    frontend: AboutTechCard;
    mobile: AboutTechCard;
  };
}

const FR: AboutCopy = {
  tabs: { company: 'Société', legal: 'Mentions légales', technical: 'Technique' },
  companyTitle: 'Société',
  companyIntro: "Informations légales et coordonnées de la société qui édite et exploite PushIT.",
  company: {
    companyLabel: 'Société',
    vatLabel: 'TVA / BCE',
    addressLabel: 'Adresse',
    emailLabel: 'Email',
    emailButton: "M'envoyer un email",
    phoneLabel: 'Téléphone',
    websiteLabel: 'Site web',
  },
  legalTitle: 'Mentions légales & protection des données',
  legalIntro: 'PushIT respecte la réglementation européenne en matière de protection des données personnelles (RGPD).',
  legalSections: [
    {
      title: 'Responsable du traitement',
      content: [
        'Le responsable du traitement des données est Foxugly SRL, éditeur de PushIT.',
        "Pour toute question relative à vos données personnelles, contactez-nous à l'adresse indiquée dans l'onglet Société.",
      ],
    },
    {
      title: 'Données collectées',
      content: [
        "Données d'identification : adresse email, prénom, nom.",
        "Données applicatives : noms de vos applications et de vos appareils, tokens d'appareil, contenu et métadonnées des notifications, périodes blanches, préférence de langue.",
        "Tokens push (Firebase Cloud Messaging) nécessaires à la distribution des notifications.",
        "Données techniques : journaux de connexion strictement nécessaires à la sécurité.",
      ],
    },
    {
      title: 'Base légale et finalités (RGPD Art. 6)',
      content: [
        "Exécution d'un contrat : gestion de votre compte, de vos applications et envoi de vos notifications push.",
        'Intérêt légitime : sécurité de la plateforme, prévention des abus, amélioration du service.',
        'Consentement : autorisation des notifications au niveau de votre appareil (révocable à tout moment).',
      ],
    },
    {
      title: 'Vos droits (RGPD Art. 15-22)',
      content: [
        "Droit d'accès : obtenir une copie de vos données personnelles.",
        'Droit de rectification : corriger des données inexactes ou incomplètes.',
        "Droit à l'effacement : demander la suppression de vos données.",
        'Droit à la portabilité : recevoir vos données dans un format structuré et lisible.',
        "Droit d'opposition : vous opposer au traitement dans certains cas.",
        'Droit de réclamation : introduire une réclamation auprès de votre autorité de contrôle nationale.',
      ],
    },
    {
      title: 'Conservation des données',
      content: [
        "Les données de compte sont conservées pendant la durée de votre inscription.",
        "Les notifications et journaux d'envoi sont conservés tant que votre compte est actif.",
        "À la suppression de votre compte, vos données personnelles sont supprimées ou anonymisées dans un délai de 30 jours.",
      ],
    },
    {
      title: 'Sécurité',
      content: [
        'Les communications sont chiffrées via HTTPS/TLS.',
        'Les mots de passe sont hachés avec un algorithme irréversible (PBKDF2).',
        "L'authentification repose sur des jetons JWT à durée de vie limitée.",
        "Les tokens applicatifs ne sont affichés qu'une seule fois et stockés hachés côté serveur.",
      ],
    },
    {
      title: 'Cookies',
      content: [
        "PushIT n'utilise pas de cookies de traçage ni de cookies publicitaires.",
        'Seuls des éléments techniques strictement nécessaires au fonctionnement (session, préférence de langue) sont utilisés.',
      ],
    },
  ],
  technicalTitle: 'Informations techniques',
  technicalIntro: "PushIT se compose d'un backend Django REST, d'une console web Angular et d'une application mobile multiplateforme, reliés par un contrat OpenAPI.",
  repositoryUrlLabel: 'Organisation GitHub',
  cards: {
    repository: {
      title: 'Dépôts',
      description: 'Le code est réparti en trois dépôts GitHub publics.',
      items: [
        'Foxugly/PushIT_server — backend Django REST',
        'Foxugly/PushIT_frontend — console web Angular',
        'Foxugly/PushIT_app — application mobile (KMP)',
      ],
    },
    backend: {
      title: 'Backend',
      description: 'API REST, logique métier et distribution des notifications.',
      items: [
        'Django et Django REST Framework',
        'drf-spectacular pour le contrat OpenAPI',
        'Simple JWT et django-filter',
        'Firebase Admin (FCM) et PostgreSQL',
      ],
    },
    frontend: {
      title: 'Frontend web',
      description: 'Console de gestion des applications, appareils et notifications.',
      items: [
        'Angular 20, TypeScript et RxJS',
        'PrimeNG 20 et SCSS',
        'Client API typé écrit à la main',
        'Karma, Jasmine et Playwright',
      ],
    },
    mobile: {
      title: 'Application mobile',
      description: 'Client mobile Android et iOS pour recevoir les notifications.',
      items: [
        'Kotlin Multiplatform et Compose Multiplatform',
        'Ktor pour le réseau',
        'Firebase Cloud Messaging',
        'Scan de QR code pour lier un appareil',
      ],
    },
  },
};

const NL: AboutCopy = {
  tabs: { company: 'Bedrijf', legal: 'Juridisch', technical: 'Technisch' },
  companyTitle: 'Bedrijf',
  companyIntro: 'Juridische informatie en contactgegevens van het bedrijf dat PushIT uitbaat.',
  company: {
    companyLabel: 'Bedrijf',
    vatLabel: 'BTW / KBO',
    addressLabel: 'Adres',
    emailLabel: 'E-mail',
    emailButton: 'Stuur mij een e-mail',
    phoneLabel: 'Telefoon',
    websiteLabel: 'Website',
  },
  legalTitle: 'Juridische informatie & gegevensbescherming',
  legalIntro: 'PushIT voldoet aan de Europese regelgeving inzake de bescherming van persoonsgegevens (AVG).',
  legalSections: [
    {
      title: 'Verwerkingsverantwoordelijke',
      content: [
        'De verwerkingsverantwoordelijke is Foxugly SRL, uitgever van PushIT.',
        'Neem voor vragen over uw persoonsgegevens contact op via het adres op het tabblad Bedrijf.',
      ],
    },
    {
      title: 'Verzamelde gegevens',
      content: [
        'Identificatiegegevens: e-mailadres, voornaam, achternaam.',
        'Applicatiegegevens: namen van uw applicaties en toestellen, toesteltokens, inhoud en metadata van notificaties, stille periodes, taalvoorkeur.',
        'Push-tokens (Firebase Cloud Messaging) nodig voor het afleveren van notificaties.',
        'Technische gegevens: verbindingslogboeken, strikt noodzakelijk voor beveiliging.',
      ],
    },
    {
      title: 'Rechtsgrond en doeleinden (AVG Art. 6)',
      content: [
        'Uitvoering van een overeenkomst: beheer van uw account, uw applicaties en het versturen van uw pushnotificaties.',
        'Gerechtvaardigd belang: beveiliging van het platform, misbruikpreventie, verbetering van de dienst.',
        'Toestemming: notificatietoestemming op uw toestel (op elk moment intrekbaar).',
      ],
    },
    {
      title: 'Uw rechten (AVG Art. 15-22)',
      content: [
        'Recht van inzage: een kopie van uw persoonsgegevens verkrijgen.',
        'Recht op rectificatie: onjuiste of onvolledige gegevens corrigeren.',
        'Recht op verwijdering: verzoek tot verwijdering van uw gegevens.',
        'Recht op overdraagbaarheid: uw gegevens ontvangen in een gestructureerd, leesbaar formaat.',
        'Recht van bezwaar: u verzetten tegen verwerking in bepaalde gevallen.',
        'Recht om klacht in te dienen: een klacht indienen bij uw nationale toezichthoudende autoriteit.',
      ],
    },
    {
      title: 'Bewaring van gegevens',
      content: [
        'Accountgegevens worden bewaard gedurende de looptijd van uw registratie.',
        'Notificaties en verzendlogboeken worden bewaard zolang uw account actief is.',
        'Bij verwijdering van uw account worden uw persoonsgegevens binnen 30 dagen verwijderd of geanonimiseerd.',
      ],
    },
    {
      title: 'Beveiliging',
      content: [
        'Communicatie wordt versleuteld via HTTPS/TLS.',
        'Wachtwoorden worden gehasht met een onomkeerbaar algoritme (PBKDF2).',
        'Authenticatie is gebaseerd op JWT-tokens met beperkte levensduur.',
        'Applicatietokens worden slechts eenmaal getoond en gehasht op de server bewaard.',
      ],
    },
    {
      title: 'Cookies',
      content: [
        'PushIT gebruikt geen tracking- of advertentiecookies.',
        'Alleen strikt noodzakelijke technische elementen (sessie, taalvoorkeur) worden gebruikt.',
      ],
    },
  ],
  technicalTitle: 'Technische informatie',
  technicalIntro: 'PushIT bestaat uit een Django REST-backend, een Angular-webconsole en een cross-platform mobiele app, verbonden via een OpenAPI-contract.',
  repositoryUrlLabel: 'GitHub-organisatie',
  cards: {
    repository: {
      title: 'Repositories',
      description: 'De code is verdeeld over drie publieke GitHub-repositories.',
      items: [
        'Foxugly/PushIT_server — Django REST-backend',
        'Foxugly/PushIT_frontend — Angular-webconsole',
        'Foxugly/PushIT_app — mobiele app (KMP)',
      ],
    },
    backend: {
      title: 'Backend',
      description: 'REST API, bedrijfslogica en aflevering van notificaties.',
      items: [
        'Django en Django REST Framework',
        'drf-spectacular voor het OpenAPI-contract',
        'Simple JWT en django-filter',
        'Firebase Admin (FCM) en PostgreSQL',
      ],
    },
    frontend: {
      title: 'Webfrontend',
      description: 'Console voor het beheer van applicaties, toestellen en notificaties.',
      items: [
        'Angular 20, TypeScript en RxJS',
        'PrimeNG 20 en SCSS',
        'Handgeschreven getypte API-client',
        'Karma, Jasmine en Playwright',
      ],
    },
    mobile: {
      title: 'Mobiele app',
      description: 'Mobiele client voor Android en iOS om notificaties te ontvangen.',
      items: [
        'Kotlin Multiplatform en Compose Multiplatform',
        'Ktor voor netwerk',
        'Firebase Cloud Messaging',
        'QR-code scannen om een toestel te koppelen',
      ],
    },
  },
};

const EN: AboutCopy = {
  tabs: { company: 'Company', legal: 'Legal notice', technical: 'Technical' },
  companyTitle: 'Company',
  companyIntro: 'Legal information and contact details of the company that operates PushIT.',
  company: {
    companyLabel: 'Company',
    vatLabel: 'VAT / BCE',
    addressLabel: 'Address',
    emailLabel: 'Email',
    emailButton: 'Send me an email',
    phoneLabel: 'Phone',
    websiteLabel: 'Website',
  },
  legalTitle: 'Legal notice & data protection',
  legalIntro: 'PushIT complies with European regulations on personal data protection (GDPR).',
  legalSections: [
    {
      title: 'Data controller',
      content: [
        'The data controller is Foxugly SRL, the publisher of PushIT.',
        'For any question regarding your personal data, contact us at the address shown in the Company tab.',
      ],
    },
    {
      title: 'Data collected',
      content: [
        'Identification data: email address, first name, last name.',
        'Application data: names of your applications and devices, device tokens, notification content and metadata, quiet periods, language preference.',
        'Push tokens (Firebase Cloud Messaging) required to deliver notifications.',
        'Technical data: connection logs strictly necessary for security.',
      ],
    },
    {
      title: 'Legal basis and purposes (GDPR Art. 6)',
      content: [
        'Performance of a contract: managing your account, your applications and sending your push notifications.',
        'Legitimate interest: platform security, abuse prevention, service improvement.',
        'Consent: notification permission on your device (revocable at any time).',
      ],
    },
    {
      title: 'Your rights (GDPR Art. 15-22)',
      content: [
        'Right of access: obtain a copy of your personal data.',
        'Right to rectification: correct inaccurate or incomplete data.',
        'Right to erasure: request the deletion of your data.',
        'Right to data portability: receive your data in a structured, readable format.',
        'Right to object: object to processing in certain cases.',
        'Right to lodge a complaint: file a complaint with your national supervisory authority.',
      ],
    },
    {
      title: 'Data retention',
      content: [
        'Account data is retained for the duration of your registration.',
        'Notifications and delivery logs are retained as long as your account is active.',
        'Upon account deletion, your personal data is deleted or anonymized within 30 days.',
      ],
    },
    {
      title: 'Security',
      content: [
        'Communications are encrypted via HTTPS/TLS.',
        'Passwords are hashed using an irreversible algorithm (PBKDF2).',
        'Authentication relies on short-lived JWT tokens.',
        'Application tokens are shown only once and stored hashed on the server.',
      ],
    },
    {
      title: 'Cookies',
      content: [
        'PushIT does not use tracking cookies or advertising cookies.',
        'Only strictly necessary technical items (session, language preference) are used.',
      ],
    },
  ],
  technicalTitle: 'Technical details',
  technicalIntro: 'PushIT is made of a Django REST backend, an Angular web console and a cross-platform mobile app, tied together by an OpenAPI contract.',
  repositoryUrlLabel: 'GitHub organisation',
  cards: {
    repository: {
      title: 'Repositories',
      description: 'The code is split across three public GitHub repositories.',
      items: [
        'Foxugly/PushIT_server — Django REST backend',
        'Foxugly/PushIT_frontend — Angular web console',
        'Foxugly/PushIT_app — mobile app (KMP)',
      ],
    },
    backend: {
      title: 'Backend',
      description: 'REST API, business rules and notification delivery.',
      items: [
        'Django and Django REST Framework',
        'drf-spectacular for the OpenAPI contract',
        'Simple JWT and django-filter',
        'Firebase Admin (FCM) and PostgreSQL',
      ],
    },
    frontend: {
      title: 'Web frontend',
      description: 'Console to manage applications, devices and notifications.',
      items: [
        'Angular 20, TypeScript and RxJS',
        'PrimeNG 20 and SCSS',
        'Hand-written typed API client',
        'Karma, Jasmine and Playwright',
      ],
    },
    mobile: {
      title: 'Mobile app',
      description: 'Mobile client for Android and iOS to receive notifications.',
      items: [
        'Kotlin Multiplatform and Compose Multiplatform',
        'Ktor for networking',
        'Firebase Cloud Messaging',
        'QR-code scanning to link a device',
      ],
    },
  },
};

const IT: AboutCopy = {
  tabs: { company: 'Società', legal: 'Note legali', technical: 'Tecnico' },
  companyTitle: 'Società',
  companyIntro: 'Informazioni legali e recapiti della società che pubblica e gestisce PushIT.',
  company: {
    companyLabel: 'Società',
    vatLabel: 'IVA / BCE',
    addressLabel: 'Indirizzo',
    emailLabel: 'Email',
    emailButton: 'Inviami una email',
    phoneLabel: 'Telefono',
    websiteLabel: 'Sito web',
  },
  legalTitle: 'Note legali e protezione dei dati',
  legalIntro: 'PushIT rispetta la normativa europea in materia di protezione dei dati personali (GDPR).',
  legalSections: [
    {
      title: 'Titolare del trattamento',
      content: [
        'Il titolare del trattamento dei dati è Foxugly SRL, editore di PushIT.',
        'Per qualsiasi domanda relativa ai tuoi dati personali, contattaci all\'indirizzo indicato nella scheda Società.',
      ],
    },
    {
      title: 'Dati raccolti',
      content: [
        'Dati identificativi: indirizzo email, nome, cognome.',
        'Dati applicativi: nomi delle tue applicazioni e dei tuoi dispositivi, token dei dispositivi, contenuto e metadati delle notifiche, periodi di silenzio, preferenza di lingua.',
        'Token push (Firebase Cloud Messaging) necessari alla consegna delle notifiche.',
        'Dati tecnici: registri di connessione strettamente necessari alla sicurezza.',
      ],
    },
    {
      title: 'Base giuridica e finalità (GDPR Art. 6)',
      content: [
        'Esecuzione di un contratto: gestione del tuo account, delle tue applicazioni e invio delle tue notifiche push.',
        'Legittimo interesse: sicurezza della piattaforma, prevenzione degli abusi, miglioramento del servizio.',
        'Consenso: autorizzazione delle notifiche a livello del tuo dispositivo (revocabile in qualsiasi momento).',
      ],
    },
    {
      title: 'I tuoi diritti (GDPR Art. 15-22)',
      content: [
        'Diritto di accesso: ottenere una copia dei tuoi dati personali.',
        'Diritto di rettifica: correggere dati inesatti o incompleti.',
        'Diritto alla cancellazione: richiedere l\'eliminazione dei tuoi dati.',
        'Diritto alla portabilità: ricevere i tuoi dati in un formato strutturato e leggibile.',
        'Diritto di opposizione: opporti al trattamento in determinati casi.',
        'Diritto di reclamo: presentare un reclamo alla tua autorità di controllo nazionale.',
      ],
    },
    {
      title: 'Conservazione dei dati',
      content: [
        'I dati dell\'account sono conservati per la durata della tua registrazione.',
        'Le notifiche e i registri di invio sono conservati finché il tuo account è attivo.',
        'Alla cancellazione del tuo account, i tuoi dati personali vengono eliminati o anonimizzati entro 30 giorni.',
      ],
    },
    {
      title: 'Sicurezza',
      content: [
        'Le comunicazioni sono cifrate tramite HTTPS/TLS.',
        'Le password sono sottoposte a hash con un algoritmo irreversibile (PBKDF2).',
        'L\'autenticazione si basa su token JWT a durata di vita limitata.',
        'I token applicativi vengono mostrati una sola volta e memorizzati con hash lato server.',
      ],
    },
    {
      title: 'Cookie',
      content: [
        'PushIT non utilizza cookie di tracciamento né cookie pubblicitari.',
        'Vengono utilizzati solo elementi tecnici strettamente necessari al funzionamento (sessione, preferenza di lingua).',
      ],
    },
  ],
  technicalTitle: 'Informazioni tecniche',
  technicalIntro: 'PushIT è composto da un backend Django REST, una console web Angular e un\'app mobile multipiattaforma, collegati da un contratto OpenAPI.',
  repositoryUrlLabel: 'Organizzazione GitHub',
  cards: {
    repository: {
      title: 'Repository',
      description: 'Il codice è suddiviso in tre repository GitHub pubblici.',
      items: [
        'Foxugly/PushIT_server — backend Django REST',
        'Foxugly/PushIT_frontend — console web Angular',
        'Foxugly/PushIT_app — app mobile (KMP)',
      ],
    },
    backend: {
      title: 'Backend',
      description: 'API REST, logica di business e consegna delle notifiche.',
      items: [
        'Django e Django REST Framework',
        'drf-spectacular per il contratto OpenAPI',
        'Simple JWT e django-filter',
        'Firebase Admin (FCM) e PostgreSQL',
      ],
    },
    frontend: {
      title: 'Frontend web',
      description: 'Console per la gestione di applicazioni, dispositivi e notifiche.',
      items: [
        'Angular 20, TypeScript e RxJS',
        'PrimeNG 20 e SCSS',
        'Client API tipizzato scritto a mano',
        'Karma, Jasmine e Playwright',
      ],
    },
    mobile: {
      title: 'App mobile',
      description: 'Client mobile Android e iOS per ricevere le notifiche.',
      items: [
        'Kotlin Multiplatform e Compose Multiplatform',
        'Ktor per la rete',
        'Firebase Cloud Messaging',
        'Scansione di QR code per collegare un dispositivo',
      ],
    },
  },
};

const ES: AboutCopy = {
  tabs: { company: 'Empresa', legal: 'Aviso legal', technical: 'Técnico' },
  companyTitle: 'Empresa',
  companyIntro: 'Información legal y datos de contacto de la empresa que edita y opera PushIT.',
  company: {
    companyLabel: 'Empresa',
    vatLabel: 'IVA / BCE',
    addressLabel: 'Dirección',
    emailLabel: 'Correo electrónico',
    emailButton: 'Enviarme un correo',
    phoneLabel: 'Teléfono',
    websiteLabel: 'Sitio web',
  },
  legalTitle: 'Aviso legal y protección de datos',
  legalIntro: 'PushIT cumple con la normativa europea en materia de protección de datos personales (RGPD).',
  legalSections: [
    {
      title: 'Responsable del tratamiento',
      content: [
        'El responsable del tratamiento de los datos es Foxugly SRL, editor de PushIT.',
        'Para cualquier pregunta relativa a tus datos personales, contáctanos en la dirección indicada en la pestaña Empresa.',
      ],
    },
    {
      title: 'Datos recopilados',
      content: [
        'Datos de identificación: dirección de correo electrónico, nombre, apellidos.',
        'Datos de la aplicación: nombres de tus aplicaciones y dispositivos, tokens de dispositivo, contenido y metadatos de las notificaciones, periodos de silencio, preferencia de idioma.',
        'Tokens push (Firebase Cloud Messaging) necesarios para la entrega de las notificaciones.',
        'Datos técnicos: registros de conexión estrictamente necesarios para la seguridad.',
      ],
    },
    {
      title: 'Base jurídica y finalidades (RGPD Art. 6)',
      content: [
        'Ejecución de un contrato: gestión de tu cuenta, de tus aplicaciones y envío de tus notificaciones push.',
        'Interés legítimo: seguridad de la plataforma, prevención de abusos, mejora del servicio.',
        'Consentimiento: autorización de las notificaciones a nivel de tu dispositivo (revocable en cualquier momento).',
      ],
    },
    {
      title: 'Tus derechos (RGPD Art. 15-22)',
      content: [
        'Derecho de acceso: obtener una copia de tus datos personales.',
        'Derecho de rectificación: corregir datos inexactos o incompletos.',
        'Derecho de supresión: solicitar la eliminación de tus datos.',
        'Derecho a la portabilidad: recibir tus datos en un formato estructurado y legible.',
        'Derecho de oposición: oponerte al tratamiento en determinados casos.',
        'Derecho de reclamación: presentar una reclamación ante tu autoridad de control nacional.',
      ],
    },
    {
      title: 'Conservación de los datos',
      content: [
        'Los datos de la cuenta se conservan durante el periodo de tu registro.',
        'Las notificaciones y los registros de envío se conservan mientras tu cuenta esté activa.',
        'Al eliminar tu cuenta, tus datos personales se suprimen o anonimizan en un plazo de 30 días.',
      ],
    },
    {
      title: 'Seguridad',
      content: [
        'Las comunicaciones se cifran mediante HTTPS/TLS.',
        'Las contraseñas se cifran con un algoritmo irreversible (PBKDF2).',
        'La autenticación se basa en tokens JWT de duración limitada.',
        'Los tokens de aplicación solo se muestran una vez y se almacenan cifrados en el servidor.',
      ],
    },
    {
      title: 'Cookies',
      content: [
        'PushIT no utiliza cookies de rastreo ni cookies publicitarias.',
        'Solo se utilizan elementos técnicos estrictamente necesarios para el funcionamiento (sesión, preferencia de idioma).',
      ],
    },
  ],
  technicalTitle: 'Información técnica',
  technicalIntro: 'PushIT se compone de un backend Django REST, una consola web Angular y una aplicación móvil multiplataforma, unidos por un contrato OpenAPI.',
  repositoryUrlLabel: 'Organización GitHub',
  cards: {
    repository: {
      title: 'Repositorios',
      description: 'El código se reparte en tres repositorios GitHub públicos.',
      items: [
        'Foxugly/PushIT_server — backend Django REST',
        'Foxugly/PushIT_frontend — consola web Angular',
        'Foxugly/PushIT_app — aplicación móvil (KMP)',
      ],
    },
    backend: {
      title: 'Backend',
      description: 'API REST, lógica de negocio y entrega de las notificaciones.',
      items: [
        'Django y Django REST Framework',
        'drf-spectacular para el contrato OpenAPI',
        'Simple JWT y django-filter',
        'Firebase Admin (FCM) y PostgreSQL',
      ],
    },
    frontend: {
      title: 'Frontend web',
      description: 'Consola para la gestión de aplicaciones, dispositivos y notificaciones.',
      items: [
        'Angular 20, TypeScript y RxJS',
        'PrimeNG 20 y SCSS',
        'Cliente API tipado escrito a mano',
        'Karma, Jasmine y Playwright',
      ],
    },
    mobile: {
      title: 'Aplicación móvil',
      description: 'Cliente móvil Android e iOS para recibir las notificaciones.',
      items: [
        'Kotlin Multiplatform y Compose Multiplatform',
        'Ktor para la red',
        'Firebase Cloud Messaging',
        'Escaneo de código QR para vincular un dispositivo',
      ],
    },
  },
};

const ABOUT_COPY: Record<LanguageCode, AboutCopy> = { fr: FR, nl: NL, en: EN, it: IT, es: ES };

export function getAboutCopy(lang: LanguageCode): AboutCopy {
  return ABOUT_COPY[lang] ?? EN;
}

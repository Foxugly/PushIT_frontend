import { computed, inject, Injectable } from '@angular/core';

import { LanguageCode, PublicI18nService } from './public-i18n.service';

const APP_COPY = {
  fr: {
    header: {
      home: 'Home',
      dashboard: 'Dashboard',
      about: 'About',
      features: 'Fonctionnalites',
      donate: 'Faire un don',
      login: 'Se connecter',
      settings: 'Settings',
      changePassword: 'Changer de mot de passe',
      logout: 'Deconnexion',
    },
    home: {
      badge: 'PushIT pour les equipes produit',
      title: 'Gerer facilement vos notifications Push.',
      description:
        'Centralisez vos campagnes push dans un espace moderne, plus calme a parcourir et plus simple a prendre en main.',
      primary: 'Voir les features',
      secondary: 'Se connecter',
      register: {
        title: 'Creer un compte',
        subtitle: 'Inscrivez-vous directement depuis la home.',
      },
    },
    features: {
      badge: 'Features',
      title: 'Tout ce que le frontend couvre deja.',
      description:
        'La page regroupe les workflows exposes par le backend ainsi que la configuration de la cible API.',
      sections: [
        {
          title: 'Fonctionnalites generales',
          items: [
            "Inscription, connexion, deconnexion et refresh du token JWT.",
            'Recuperation du profil courant et mise a jour de la langue utilisateur.',
            'Langues supportees : FR, NL et EN.',
            'Gestion de session securisee par JWT cote frontend classique.',
          ],
        },
        {
          title: 'Fonctionnalites des applications',
          items: [
            "Liste, creation, detail, modification et suppression d'une application.",
            "Activation, desactivation, revocation et regeneration du token applicatif.",
            "Recuperation des informations utiles pour l'integration mobile ou API.",
            "Gestion complete du cycle de vie d'une application de push.",
          ],
        },
        {
          title: 'Fonctionnalites des devices',
          items: [
            'Liste, detail, modification et suppression des devices visibles.',
            "Visualisation des applications liees a un device.",
            'Liaison automatique via X-App-Token.',
            "Support du flux mobile : installation, scan QR code, recuperation du push token et creation ou mise a jour du lien cote backend.",
          ],
        },
        {
          title: 'Fonctionnalites des notifications',
          items: [
            "Creation de notifications ciblees par application et liste explicite de devices.",
            'Liste, detail, envoi manuel et statistiques des notifications.',
            'Gestion des notifications futures : liste, detail, modification et suppression.',
            "Filtres par application, statut et date effective d'envoi, avec prise en compte des envois partiels et de `effective_scheduled_for`.",
          ],
        },
        {
          title: 'Fonctionnalites des periodes blanches',
          items: [
            'Gestion des periodes blanches par application ou par device.',
            'Support des periodes ONCE et RECURRING, avec modification, suppression et activation.',
            'Gestion des fenetres qui passent minuit et des fenetres contigues.',
            "Impact metier distinct : decalage global de notification cote application, ou report de delivery cote device.",
          ],
        },
        {
          title: 'Fonctionnalite envoi par mail',
          items: [
            "Reception d'un email entrant et resolution de l'application via le prefixe destinataire.",
            "Transformation du sujet en titre et du contenu texte en message, avec planification via un marqueur `SEND_AT`.",
            "Controles d'acces sur domaine, expediteur et appartenance de l'application ciblee.",
            "Gestion de l'idempotence via `message_id`, avec rejection des rejeux au contenu different.",
          ],
        },
      ],
      backendTitle: 'Configuration backend',
      backendDescription:
        "Definissez ici l'URL de base de l'API utilisee par tout le frontend Angular.",
      submit: 'Enregistrer',
      saved: 'Enregistre',
    },
    donate: {
      badge: 'Donate',
      title: 'Soutenir une console plus simple.',
      description:
        "Si le projet vous aide, cette page sert de point d'ancrage pour un futur vrai flux de donation.",
      cards: [
        'Soutien ponctuel pour le maintien du projet',
        'Participation aux evolutions UX et i18n',
        'Aide au financement des iterations produit',
      ],
      button: 'Bientot disponible',
    },
    about: {
      badge: 'About',
      title: 'A propos de PushIT.',
      description:
        "Cette page sert de point d'ancrage pour presenter le produit, l'equipe et la vision.",
      placeholder: 'Contenu a venir.',
    },
    auth: {
      eyebrow: 'Connexion',
      title: 'Acceder a votre espace.',
      description: 'Connectez-vous pour acceder au dashboard PushIT et gerer vos campagnes.',
      email: 'Email',
      password: 'Mot de passe',
      passwordPlaceholder: 'Mot de passe',
      rememberMe: 'Se souvenir de moi',
      forgotPassword: 'Mot de passe oublie ?',
      register: 'Inscription',
      submit: 'Se connecter',
      pending: 'Connexion...',
    },
    registerPage: {
      eyebrow: 'Inscription',
      title: 'Creer un compte PushIT.',
      description:
        'Inscrivez-vous pour acceder a la console et commencer a gerer vos applications et vos notifications.',
    },
    registerPanel: {
      defaultTitle: 'Inscription',
      defaultSubtitle: 'Compte utilisateur',
      email: 'Email',
      username: 'Username',
      password: 'Mot de passe',
      passwordPlaceholder: 'Minimum 8 caracteres',
      language: 'Langue',
      languagePlaceholder: 'Choisir une langue',
      submit: 'Creer le compte',
      pending: 'Creation...',
      loginPrompt: 'Deja un compte ?',
      loginLink: 'Se connecter',
    },
    forgotPassword: {
      eyebrow: 'Mot de passe oublie',
      title: 'Recuperer l acces.',
      description:
        "Saisissez votre email. L'UI est prete, mais le backend Swagger fourni n'expose pas encore d'endpoint de reinitialisation.",
      email: 'Email',
      submit: 'Continuer',
      submitted:
        'Demande enregistree cote interface. Il faudra brancher cette page a un endpoint backend de reset lorsqu il sera disponible.',
      registerPrompt: "Besoin d'un compte ?",
      registerLink: 'Inscription',
    },
    footer: {
      copyright: 'Copyright Foxugly 2026',
    },
    console: {
      sections: [
        {
          label: 'Applications',
          description: 'Creer, modifier et gerer vos tokens.',
          icon: 'pi pi-briefcase',
          link: '/dashboard/applications',
          countKey: 'apps',
        },
        {
          label: 'Devices',
          description: 'Consulter et mettre a jour les terminaux lies.',
          icon: 'pi pi-mobile',
          link: '/dashboard/devices',
          countKey: 'devices',
        },
        {
          label: 'Notifications',
          description: 'Cibler, planifier et suivre les envois.',
          icon: 'pi pi-envelope',
          link: '/dashboard/notifications',
          countKey: 'notifications',
        },
        {
          label: 'Periodes blanches',
          description: 'Piloter les fenetres de silence applicatives et device.',
          icon: 'pi pi-moon',
          link: '/dashboard/quiet-periods',
          countKey: 'quietPeriods',
        },
      ],
      dashboard: {
        eyebrow: 'Dashboard',
        title: "Vue d'ensemble",
        description: "Retrouvez l'etat global de votre console et accedez rapidement aux ecrans de gestion.",
        cta: 'Applications',
        metrics: {
          apps: 'Applications',
          activeApps: 'Actives',
          devices: 'Devices',
          notifications: 'Notifications',
          quietPeriods: 'Periodes blanches',
        },
      },
      settings: {
        eyebrow: 'Settings',
        title: 'Parametres de la console',
        description: 'Cette page centralise la configuration frontend utilisee pour joindre le backend.',
        backendEyebrow: 'Backend',
        backendTitle: "Prefixe de l'API",
        apiUrl: 'URL API',
        language: 'Langue du compte',
        submit: 'Enregistrer',
        saved: 'Preferences enregistrees.',
        sessionEyebrow: 'Session',
        sessionTitle: 'Compte connecte',
        fallbackUser: 'Utilisateur',
        fallbackEmail: 'Email indisponible',
        activePrefix: 'Prefixe actif',
        activeLanguage: 'Langue active',
      },
      changePassword: {
        eyebrow: 'Mot de passe',
        title: 'Changer de mot de passe',
        description: "Le frontend est pret a recevoir cette action, mais le backend Swagger fourni n'expose pas encore d'endpoint dedie.",
        backendEyebrow: 'Etat backend',
        backendTitle: 'Action non disponible',
        note:
          "Le Swagger expose actuellement `login`, `logout`, `me`, `refresh` et `register`, mais pas de route `change-password`. Quand l'endpoint sera disponible, cette page pourra accueillir le formulaire de mise a jour.",
      },
      applicationForm: {
        name: 'Nom',
        description: 'Description',
        namePlaceholder: 'Push mobile Europe',
        descriptionPlaceholder: 'Canal, environnement, usage...',
      },
      deviceForm: {
        name: 'Nom',
        platform: 'Plateforme',
        pushTokenStatus: 'Statut du push token',
      },
    },
  },
  nl: {
    header: {
      home: 'Home',
      dashboard: 'Dashboard',
      about: 'About',
      features: 'Functies',
      donate: 'Doneren',
      login: 'Inloggen',
      settings: 'Settings',
      changePassword: 'Wachtwoord wijzigen',
      logout: 'Uitloggen',
    },
    home: {
      badge: 'PushIT voor productteams',
      title: 'Beheer je pushmeldingen eenvoudig.',
      description:
        'Centraliseer pushcampagnes in een moderne ruimte die rustiger leest en eenvoudiger in gebruik is.',
      primary: 'Bekijk de features',
      secondary: 'Inloggen',
      register: {
        title: 'Account aanmaken',
        subtitle: 'Registreer je rechtstreeks vanaf de homepagina.',
      },
    },
    features: {
      badge: 'Features',
      title: 'Alles wat de frontend al ondersteunt.',
      description:
        'Deze pagina groepeert de backend-workflows en de configuratie van de API-doelomgeving.',
      sections: [
        {
          title: 'Algemene functionaliteiten',
          items: [
            'Registratie, login, logout en refresh van het JWT-token.',
            'Ophalen van het huidige profiel en bijwerken van de gebruikerstaal.',
            'Ondersteunde talen: FR, NL en EN.',
            'Veilige sessiebeheer met JWT aan frontendzijde.',
          ],
        },
        {
          title: 'Applicatiefunctionaliteiten',
          items: [
            'Lijst, creatie, detail, wijziging en verwijdering van een applicatie.',
            'Activeren, deactiveren, intrekken en vernieuwen van het applicatietoken.',
            'Ophalen van de integratiegegevens voor mobile of API.',
            'Volledig beheer van de levenscyclus van een pushapplicatie.',
          ],
        },
        {
          title: 'Devicefunctionaliteiten',
          items: [
            'Lijst, detail, wijziging en verwijdering van zichtbare devices.',
            'Visualisatie van de applicaties die aan een device gekoppeld zijn.',
            'Automatische koppeling via X-App-Token.',
            'Ondersteuning van de mobiele flow: installatie, QR-scan, ophalen van de push token en aanmaak of update van de koppeling in de backend.',
          ],
        },
        {
          title: 'Notificatiefuncties',
          items: [
            'Aanmaken van gerichte notificaties per applicatie en expliciete device-lijst.',
            'Lijst, detail, manuele verzending en statistieken van notificaties.',
            'Beheer van toekomstige notificaties: lijst, detail, wijziging en verwijdering.',
            'Filters op applicatie, status en effectieve verzenddatum, inclusief partiele verzendingen en `effective_scheduled_for`.',
          ],
        },
        {
          title: 'Stille-periodefunctionaliteiten',
          items: [
            'Beheer van stille periodes per applicatie of per device.',
            'Ondersteuning voor ONCE- en RECURRING-periodes, met wijziging, verwijdering en activatie.',
            'Beheer van vensters die over middernacht lopen en aaneengesloten vensters.',
            'Duidelijke business-impact: globale verschuiving op applicatieniveau, of uitgestelde delivery op deviceniveau.',
          ],
        },
        {
          title: 'Mailverzendfunctionaliteit',
          items: [
            'Ontvangst van inkomende mail en koppeling aan de applicatie via het bestemmingsprefix.',
            'Omzetting van onderwerp naar titel en platte tekst naar bericht, met planning via `SEND_AT`.',
            'Toegangscontroles op domein, afzender en eigendom van de doelapplicatie.',
            'Idempotentie via `message_id`, met weigering bij hergebruik met andere inhoud.',
          ],
        },
      ],
      backendTitle: 'Backendconfiguratie',
      backendDescription:
        'Definieer hier de basis-URL van de API die door de Angular-frontend wordt gebruikt.',
      submit: 'Opslaan',
      saved: 'Opgeslagen',
    },
    donate: {
      badge: 'Donate',
      title: 'Steun een eenvoudigere console.',
      description:
        'Als het project nuttig is, dient deze pagina als basis voor een toekomstige donatiestroom.',
      cards: [
        'Eenmalige steun voor onderhoud van het project',
        'Bijdrage aan UX- en i18n-verbeteringen',
        'Ondersteuning voor productiteraties',
      ],
      button: 'Binnenkort beschikbaar',
    },
    about: {
      badge: 'About',
      title: 'Over PushIT.',
      description:
        'Deze pagina is bedoeld om later het product, het team en de visie voor te stellen.',
      placeholder: 'Inhoud volgt binnenkort.',
    },
    auth: {
      eyebrow: 'Inloggen',
      title: 'Toegang tot je ruimte.',
      description: 'Log in om het PushIT-dashboard te openen en je campagnes te beheren.',
      email: 'Email',
      password: 'Wachtwoord',
      passwordPlaceholder: 'Wachtwoord',
      rememberMe: 'Onthoud mij',
      forgotPassword: 'Wachtwoord vergeten?',
      register: 'Registreren',
      submit: 'Inloggen',
      pending: 'Bezig met inloggen...',
    },
    registerPage: {
      eyebrow: 'Registratie',
      title: 'Maak een PushIT-account aan.',
      description:
        'Registreer je om toegang te krijgen tot de console en je applicaties en notificaties te beheren.',
    },
    registerPanel: {
      defaultTitle: 'Registratie',
      defaultSubtitle: 'Gebruikersaccount',
      email: 'Email',
      username: 'Gebruikersnaam',
      password: 'Wachtwoord',
      passwordPlaceholder: 'Minimaal 8 tekens',
      language: 'Taal',
      languagePlaceholder: 'Kies een taal',
      submit: 'Account aanmaken',
      pending: 'Bezig met aanmaken...',
      loginPrompt: 'Al een account?',
      loginLink: 'Inloggen',
    },
    forgotPassword: {
      eyebrow: 'Wachtwoord vergeten',
      title: 'Toegang herstellen.',
      description:
        'Voer je email in. De UI is klaar, maar de aangeleverde backend exposeert nog geen reset-endpoint.',
      email: 'Email',
      submit: 'Doorgaan',
      submitted:
        'Aanvraag geregistreerd aan UI-zijde. Deze pagina moet later nog gekoppeld worden aan een backend reset-endpoint.',
      registerPrompt: 'Nog geen account?',
      registerLink: 'Registreren',
    },
    footer: {
      copyright: 'Copyright Foxugly 2026',
    },
    console: {
      sections: [
        {
          label: 'Applicaties',
          description: 'Aanmaken, bewerken en tokens beheren.',
          icon: 'pi pi-briefcase',
          link: '/dashboard/applications',
          countKey: 'apps',
        },
        {
          label: 'Devices',
          description: 'Gekoppelde toestellen raadplegen en bijwerken.',
          icon: 'pi pi-mobile',
          link: '/dashboard/devices',
          countKey: 'devices',
        },
        {
          label: 'Notificaties',
          description: 'Verzendingen targeten, plannen en opvolgen.',
          icon: 'pi pi-envelope',
          link: '/dashboard/notifications',
          countKey: 'notifications',
        },
        {
          label: 'Stille periodes',
          description: 'Applicatieve en device-stiltevensters beheren.',
          icon: 'pi pi-moon',
          link: '/dashboard/quiet-periods',
          countKey: 'quietPeriods',
        },
      ],
      dashboard: {
        eyebrow: 'Dashboard',
        title: 'Overzicht',
        description: 'Bekijk de globale staat van je console en ga snel naar de beheerschermen.',
        cta: 'Applicaties',
        metrics: {
          apps: 'Applicaties',
          activeApps: 'Actief',
          devices: 'Devices',
          notifications: 'Notificaties',
          quietPeriods: 'Stille periodes',
        },
      },
      settings: {
        eyebrow: 'Settings',
        title: 'Console-instellingen',
        description: 'Deze pagina centraliseert de frontendconfiguratie om de backend te bereiken.',
        backendEyebrow: 'Backend',
        backendTitle: 'API-prefix',
        apiUrl: 'API-URL',
        language: 'Accounttaal',
        submit: 'Opslaan',
        saved: 'Voorkeuren opgeslagen.',
        sessionEyebrow: 'Sessie',
        sessionTitle: 'Ingelogd account',
        fallbackUser: 'Gebruiker',
        fallbackEmail: 'Email niet beschikbaar',
        activePrefix: 'Actieve prefix',
        activeLanguage: 'Actieve taal',
      },
      changePassword: {
        eyebrow: 'Wachtwoord',
        title: 'Wachtwoord wijzigen',
        description: 'De frontend is klaar voor deze actie, maar de meegeleverde backend exposeert nog geen specifieke endpoint.',
        backendEyebrow: 'Backendstatus',
        backendTitle: 'Actie niet beschikbaar',
        note:
          'De Swagger exposeert momenteel `login`, `logout`, `me`, `refresh` en `register`, maar geen route `change-password`. Zodra die endpoint beschikbaar is, kan deze pagina het updateformulier bevatten.',
      },
      applicationForm: {
        name: 'Naam',
        description: 'Beschrijving',
        namePlaceholder: 'Push mobile Europe',
        descriptionPlaceholder: 'Kanaal, omgeving, gebruik...',
      },
      deviceForm: {
        name: 'Naam',
        platform: 'Platform',
        pushTokenStatus: 'Push-tokenstatus',
      },
    },
  },
  en: {
    header: {
      home: 'Home',
      dashboard: 'Dashboard',
      about: 'About',
      features: 'Features',
      donate: 'Donate',
      login: 'Log in',
      settings: 'Settings',
      changePassword: 'Change password',
      logout: 'Log out',
    },
    home: {
      badge: 'PushIT for product teams',
      title: 'Manage your push notifications easily.',
      description:
        'Centralize push campaigns in a modern workspace designed to feel lighter and easier to operate.',
      primary: 'See features',
      secondary: 'Log in',
      register: {
        title: 'Create an account',
        subtitle: 'Sign up directly from the homepage.',
      },
    },
    features: {
      badge: 'Features',
      title: 'Everything the frontend already covers.',
      description:
        'This page gathers the backend workflows already exposed in the UI along with API target configuration.',
      sections: [
        {
          title: 'General capabilities',
          items: [
            'User sign-up, sign-in, sign-out and JWT refresh.',
            'Current profile retrieval and user language update.',
            'Supported languages: FR, NL and EN.',
            'Secure JWT-based session handling on the frontend.',
          ],
        },
        {
          title: 'Application capabilities',
          items: [
            'List, create, inspect, update and delete applications.',
            'Activate, deactivate, revoke and regenerate the application token.',
            'Expose the data needed for mobile or API integration.',
            'Cover the full push application lifecycle.',
          ],
        },
        {
          title: 'Device capabilities',
          items: [
            'List, inspect, update and delete visible devices.',
            'Show which applications a device is linked to.',
            'Automatically link a device through X-App-Token.',
            'Support the mobile flow: install, QR scan, retrieve push token and create or update the backend link.',
          ],
        },
        {
          title: 'Notification capabilities',
          items: [
            'Create targeted notifications by application and explicit device list.',
            'List, inspect, send manually and monitor notification statistics.',
            'Manage future notifications: list, inspect, update and delete.',
            'Filter by application, status and effective send date, including partial delivery handling and `effective_scheduled_for`.',
          ],
        },
        {
          title: 'Quiet period capabilities',
          items: [
            'Manage quiet periods at application or device level.',
            'Support ONCE and RECURRING periods, with update, delete and activation.',
            'Handle windows crossing midnight and contiguous windows.',
            'Reflect the distinct business impact: global notification shift for applications, device-only delivery delay for devices.',
          ],
        },
        {
          title: 'Email delivery capability',
          items: [
            'Receive inbound email and resolve the target application from the recipient prefix.',
            'Turn the subject into a notification title and the text body into a message, with optional `SEND_AT` scheduling.',
            'Validate domain, sender and target application ownership.',
            'Handle idempotency through `message_id`, rejecting replays with different content.',
          ],
        },
      ],
      backendTitle: 'Backend configuration',
      backendDescription:
        'Set here the API base URL used across the Angular frontend.',
      submit: 'Save',
      saved: 'Saved',
    },
    donate: {
      badge: 'Donate',
      title: 'Support a simpler console.',
      description:
        'If the project helps you, this page acts as a placeholder for a future real donation flow.',
      cards: [
        'One-off support for project maintenance',
        'Contribution to UX and i18n improvements',
        'Help fund product iterations',
      ],
      button: 'Coming soon',
    },
    about: {
      badge: 'About',
      title: 'About PushIT.',
      description:
        'This page is a placeholder for future product, team and vision content.',
      placeholder: 'Content coming soon.',
    },
    auth: {
      eyebrow: 'Log in',
      title: 'Access your workspace.',
      description: 'Log in to access the PushIT dashboard and manage your campaigns.',
      email: 'Email',
      password: 'Password',
      passwordPlaceholder: 'Password',
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot password?',
      register: 'Sign up',
      submit: 'Log in',
      pending: 'Logging in...',
    },
    registerPage: {
      eyebrow: 'Sign up',
      title: 'Create a PushIT account.',
      description:
        'Sign up to access the console and start managing your applications and notifications.',
    },
    registerPanel: {
      defaultTitle: 'Sign up',
      defaultSubtitle: 'User account',
      email: 'Email',
      username: 'Username',
      password: 'Password',
      passwordPlaceholder: 'Minimum 8 characters',
      language: 'Language',
      languagePlaceholder: 'Choose a language',
      submit: 'Create account',
      pending: 'Creating...',
      loginPrompt: 'Already have an account?',
      loginLink: 'Log in',
    },
    forgotPassword: {
      eyebrow: 'Forgot password',
      title: 'Recover access.',
      description:
        'Enter your email. The UI is ready, but the provided backend does not expose a reset endpoint yet.',
      email: 'Email',
      submit: 'Continue',
      submitted:
        'Request stored on the UI side. This page still needs to be connected to a backend reset endpoint when available.',
      registerPrompt: 'Need an account?',
      registerLink: 'Sign up',
    },
    footer: {
      copyright: 'Copyright Foxugly 2026',
    },
    console: {
      sections: [
        {
          label: 'Applications',
          description: 'Create, edit and manage your tokens.',
          icon: 'pi pi-briefcase',
          link: '/dashboard/applications',
          countKey: 'apps',
        },
        {
          label: 'Devices',
          description: 'Inspect and update linked devices.',
          icon: 'pi pi-mobile',
          link: '/dashboard/devices',
          countKey: 'devices',
        },
        {
          label: 'Notifications',
          description: 'Target, schedule and track deliveries.',
          icon: 'pi pi-envelope',
          link: '/dashboard/notifications',
          countKey: 'notifications',
        },
        {
          label: 'Quiet periods',
          description: 'Control application and device quiet windows.',
          icon: 'pi pi-moon',
          link: '/dashboard/quiet-periods',
          countKey: 'quietPeriods',
        },
      ],
      dashboard: {
        eyebrow: 'Dashboard',
        title: 'Overview',
        description: 'See the global state of your console and jump quickly to management screens.',
        cta: 'Applications',
        metrics: {
          apps: 'Applications',
          activeApps: 'Active',
          devices: 'Devices',
          notifications: 'Notifications',
          quietPeriods: 'Quiet periods',
        },
      },
      settings: {
        eyebrow: 'Settings',
        title: 'Console settings',
        description: 'This page centralizes the frontend configuration used to reach the backend.',
        backendEyebrow: 'Backend',
        backendTitle: 'API prefix',
        apiUrl: 'API URL',
        language: 'Account language',
        submit: 'Save',
        saved: 'Preferences saved.',
        sessionEyebrow: 'Session',
        sessionTitle: 'Signed-in account',
        fallbackUser: 'User',
        fallbackEmail: 'Email unavailable',
        activePrefix: 'Active prefix',
        activeLanguage: 'Active language',
      },
      changePassword: {
        eyebrow: 'Password',
        title: 'Change password',
        description: 'The frontend is ready for this action, but the provided backend does not expose a dedicated endpoint yet.',
        backendEyebrow: 'Backend status',
        backendTitle: 'Action unavailable',
        note:
          'The Swagger currently exposes `login`, `logout`, `me`, `refresh` and `register`, but no `change-password` route. When the endpoint becomes available, this page can host the update form.',
      },
      applicationForm: {
        name: 'Name',
        description: 'Description',
        namePlaceholder: 'Push mobile Europe',
        descriptionPlaceholder: 'Channel, environment, usage...',
      },
      deviceForm: {
        name: 'Name',
        platform: 'Platform',
        pushTokenStatus: 'Push token status',
      },
    },
  },
} as const;

@Injectable({ providedIn: 'root' })
export class AppCopyService {
  private readonly i18n = inject(PublicI18nService);

  readonly current = computed(() => APP_COPY[this.i18n.language() as LanguageCode] ?? APP_COPY.fr);
}

# Clusters Theatre Website

A modern, animated website for Clusters Theatre with booking system, ticket generation, email confirmations, and admin dashboard.

## Features

### Booking System
- **Film Club Shows**: ₹150 per person
- **Cluster Preview Movies**: ₹4000 + 18% GST
- Real-time price calculation
- Payment QR code integration

### Ticket Features
- Movie poster included in ticket
- Print ticket functionality
- **Real email confirmation via EmailJS** (Gmail/Outlook integration)
- Unique ticket ID generation

### Admin Console
- **Login Credentials**:
  - Username: `guhan`
  - Password: `143`
- View all bookings and sales statistics
- **Manage Movies**: Add, edit, and delete movies with custom posters, dates, and times
- Generate statements
- Download statements as JSON
- Print statements

### Theatre Information
- Seat Capacity: 43 Persons
- Aspect Ratio: 2:35:1 (Cinemascope)
- Audio Support: Upto Dolby 5.1 Surround
- Banner Size: 8*4ft

### Rules & Regulations
- No Food or Beverages allowed
- No Footwear allowed
- 50% Advance Payment for Cluster Preview Shows
- Payment Mode: Cash/GPay

## Usage

1. Open `index.html` in a web browser
2. Browse available movies and show types
3. Click "Book Now" to make a booking
4. Fill in the booking form
5. View and print your ticket
6. Access admin dashboard via "Admin" link in navigation

## Technologies Used

- HTML5
- CSS3 (with animations and 3D effects)
- JavaScript (ES6+)
- LocalStorage for data persistence
- EmailJS for email confirmations
- Font Awesome icons

## Browser Compatibility

Works on all modern browsers (Chrome, Firefox, Safari, Edge)

## Email Configuration

To enable real email confirmations:

1. **Set up EmailJS** (see `EMAILJS_SETUP.md` for detailed instructions)
2. Get your EmailJS Service ID, Template ID, and Public Key
3. Update the `EMAILJS_CONFIG` in `script.js` with your credentials
4. Test by making a booking and clicking "Send Email"

**Note:** Without EmailJS configuration, the system will show a fallback message. The free EmailJS tier includes 200 emails/month.

## Notes

- All booking data is stored in browser's LocalStorage
- Movies can be managed from the admin dashboard
- Payment QR code uses a placeholder service
- Movie posters can be added via URL in the admin panel
- Film Club Shows: Monthly - Only 2 shows

